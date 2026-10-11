import type { NextApiRequest, NextApiResponse } from "next";
import { getUserPermissionKeys } from "@/lib/permissions";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import {
  actionsForPermissions,
  resolveIntent,
  type OpenUiAction,
} from "@/components/openui/library";
import { chatWithTools, isModelConfigured, type ToolDef } from "@/lib/openui/model";

/**
 * Provider-agnostic OpenUI assistant endpoint.
 *
 * The model (any OpenAI-compatible provider) may only choose from the
 * caller's permitted, allowlisted actions. It cannot write anything: write
 * actions resolve to the reviewed workflow route. If no provider is configured
 * — or the model errors — we fall back to deterministic keyword routing so the
 * assistant always works. The provider key never leaves the server.
 */

function actionToTool(a: OpenUiAction): ToolDef {
  return {
    name: a.id.replace(/[^a-zA-Z0-9_]/g, "_"),
    description: `${a.description} (${a.kind === "workflow" ? "opens a reviewed workflow" : "read-only"})`,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional short reason/summary of what the user asked.",
        },
      },
      additionalProperties: false,
    },
  };
}

const SYSTEM_PROMPT = [
  "You are the Jojjy Gallery CRM assistant.",
  "You help staff find the right built-in workflow. You have a fixed set of tools;",
  "call at most one tool when the user's request clearly matches it, otherwise reply",
  "in one short sentence explaining what you can help with.",
  "You never perform writes yourself — workflow tools only open a page where the",
  "staff member reviews and confirms. Never invent data or claim an action succeeded.",
].join(" ");

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

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  const user = await prisma.crmUser.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });
  if (!user?.isActive) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  const permissions = [...(await getUserPermissionKeys(session.user.id))];

  const { message } = req.body as { message?: string };
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) {
    return res.status(400).json({ success: false, message: "message is required" });
  }

  const allowed = actionsForPermissions(permissions);

  // No provider configured → deterministic routing.
  if (!isModelConfigured()) {
    const action = resolveIntent(text, permissions);
    return res.status(200).json({
      success: true,
      data: {
        mode: "deterministic",
        reply: action
          ? action.description
          : "I can help with events, ticket issuance, check-in, refunds, and reports.",
        actionId: action?.id ?? null,
      },
    });
  }

  try {
    const tools = allowed.map(actionToTool);
    const result = await chatWithTools({
      system: SYSTEM_PROMPT,
      user: text,
      tools,
    });

    if (result.toolCall) {
      // Map back from the sanitized tool name to the real action id.
      const matched = allowed.find(
        (a) => a.id.replace(/[^a-zA-Z0-9_]/g, "_") === result.toolCall!.name
      );
      if (matched) {
        return res.status(200).json({
          success: true,
          data: {
            mode: "model",
            reply: result.content || matched.description,
            actionId: matched.id,
          },
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        mode: "model",
        reply:
          result.content ||
          "I can help with events, ticket issuance, check-in, refunds, and reports.",
        actionId: null,
      },
    });
  } catch (error) {
    console.error("OpenUI chat model error, falling back:", error);
    const action = resolveIntent(text, permissions);
    return res.status(200).json({
      success: true,
      data: {
        mode: "deterministic",
        reply: action
          ? action.description
          : "The assistant is unavailable right now. Try again.",
        actionId: action?.id ?? null,
      },
    });
  }
}
