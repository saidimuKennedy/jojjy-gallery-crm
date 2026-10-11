import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/require-permission";

/**
 * Events that have ticket types, for the check-in event picker. Deliberately
 * minimal (no guest PII), gated on ticket permissions.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  if (
    !(await requireAnyPermission(req, res, ["tickets:check-in", "tickets:read"]))
  ) {
    return;
  }

  try {
    const events = await prisma.event.findMany({
      where: { ticketTypes: { some: {} } },
      orderBy: { startsAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        startsAt: true,
        status: true,
        ticketTypes: { select: { id: true, name: true } },
      },
    });

    return res.status(200).json({
      success: true,
      data: events.map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        startsAt: e.startsAt.toISOString(),
        status: e.status,
        ticketTypeCount: e.ticketTypes.length,
      })),
    });
  } catch (error) {
    console.error("Error listing check-in events:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}
