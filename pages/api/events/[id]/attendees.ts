import type { NextApiRequest, NextApiResponse } from "next";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

/**
 * Attendee/ticket rows for an event, with guest PII. Requires both ticket and
 * order visibility (attendee contact is buyer PII).
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

  if (!(await requirePermission(req, res, "tickets:read"))) return;
  if (!(await requirePermission(req, res, "orders:read"))) return;

  const { id, q, status, source, page = "1", limit = "50" } = req.query;
  const eventId = typeof id === "string" ? parseInt(id, 10) : NaN;
  if (isNaN(eventId)) {
    return res.status(400).json({ success: false, message: "Invalid event id" });
  }

  const pageNum = Math.max(1, parseInt(Array.isArray(page) ? page[0] : page, 10) || 1);
  const limitNum = Math.min(
    200,
    Math.max(1, parseInt(Array.isArray(limit) ? limit[0] : limit, 10) || 50)
  );

  const where: Prisma.TicketWhereInput = {
    ticketType: { eventId },
  };
  if (typeof status === "string" && status) where.status = status as never;
  if (typeof source === "string" && source) where.source = source as never;
  if (typeof q === "string" && q.trim()) {
    const term = q.trim();
    where.OR = [
      { code: { contains: term, mode: "insensitive" } },
      { holderName: { contains: term, mode: "insensitive" } },
      { holderEmail: { contains: term, mode: "insensitive" } },
    ];
  }

  try {
    const [rows, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          ticketType: { select: { id: true, name: true } },
          checkedInByCrmUser: { select: { id: true, name: true, email: true } },
          checkIns: {
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { crmUser: { select: { id: true, name: true, email: true } } },
          },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: rows.map((t) => ({
        id: t.id,
        code: t.code,
        ticketType: t.ticketType.name,
        source: t.source,
        status: t.status,
        holderName: t.holderName,
        holderEmail: t.holderEmail,
        checkedInAt: t.checkedInAt ? t.checkedInAt.toISOString() : null,
        checkedInBy: t.checkedInByCrmUser
          ? t.checkedInByCrmUser.name || t.checkedInByCrmUser.email
          : null,
        history: t.checkIns.map((c) => ({
          action: c.action,
          at: c.createdAt.toISOString(),
          by: c.crmUser.name || c.crmUser.email,
          reason: c.reason,
        })),
      })),
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error("Error listing attendees:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}
