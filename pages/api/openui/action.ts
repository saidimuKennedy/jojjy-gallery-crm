import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";
import { OPENUI_ACTIONS } from "@/components/openui/library";

/**
 * OpenUI action guard. Every action is validated against the allowlist, and the
 * caller's permission is enforced here — never in the browser. READ actions are
 * executed against CRM data directly. WORKFLOW (write) actions are never
 * executed from here: the response tells the UI to open the deterministic
 * workflow page, which runs the normal confirmation + authenticated API call.
 * No Prisma/database tools are ever exposed to the model.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const { actionId } = req.body as { actionId?: string };
  const action = OPENUI_ACTIONS.find((a) => a.id === actionId);
  if (!action) {
    return res
      .status(400)
      .json({ success: false, message: "Unknown or disallowed action." });
  }

  const auth = await requirePermission(req, res, action.permission);
  if (!auth) return;

  if (action.kind === "workflow") {
    if (!action.route) {
      return res
        .status(500)
        .json({ success: false, message: "Action has no workflow route." });
    }
    return res.status(200).json({
      success: true,
      data: {
        kind: "workflow",
        route: action.route,
        requiresConfirmation: action.requiresConfirmation ?? false,
        message:
          "This opens the reviewed workflow. Nothing is written until you confirm it there.",
      },
    });
  }

  try {
    if (action.id === "events.list") {
      const events = await prisma.event.findMany({
        orderBy: { startsAt: "desc" },
        take: 20,
        select: { id: true, title: true, status: true, startsAt: true },
      });
      return res.status(200).json({
        success: true,
        data: {
          kind: "read",
          summary: `${events.length} event(s).`,
          events: events.map((e) => ({
            id: e.id,
            title: e.title,
            status: e.status,
            startsAt: e.startsAt.toISOString(),
          })),
        },
      });
    }

    return res
      .status(501)
      .json({ success: false, message: "Read action not implemented." });
  } catch (error) {
    console.error("OpenUI action error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}
