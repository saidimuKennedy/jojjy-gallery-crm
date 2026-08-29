import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

function parseOptionalDate(value: unknown): Date | null {
  if (value === null || value === "" || value === undefined) return null;
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function serializeTicketType(tt: {
  id: number;
  eventId: number;
  name: string;
  price: { toNumber(): number };
  quantity: number;
  quantitySold: number;
  salesStart: Date | null;
  salesEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...tt,
    price: tt.price.toNumber(),
    salesStart: tt.salesStart ? tt.salesStart.toISOString() : null,
    salesEnd: tt.salesEnd ? tt.salesEnd.toISOString() : null,
    createdAt: tt.createdAt.toISOString(),
    updatedAt: tt.updatedAt.toISOString(),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  const eventId = typeof id === "string" ? parseInt(id, 10) : NaN;
  if (isNaN(eventId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid event id" });
  }

  if (req.method === "GET") {
    if (!(await requirePermission(req, res, "tickets:read"))) return;
    try {
      const ticketTypes = await prisma.ticketType.findMany({
        where: { eventId },
        orderBy: { price: "asc" },
      });
      return res.status(200).json({
        success: true,
        data: ticketTypes.map(serializeTicketType),
      });
    } catch (error) {
      console.error("Error listing ticket types:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  if (req.method === "POST") {
    if (!(await requirePermission(req, res, "tickets:write"))) return;
    try {
      const { name, price, quantity, salesStart, salesEnd } = req.body;
      if (!name || price === undefined || quantity === undefined) {
        return res.status(400).json({
          success: false,
          message: "name, price, and quantity are required",
        });
      }

      const parsedStart = parseOptionalDate(salesStart);
      const parsedEnd = parseOptionalDate(salesEnd);
      if (parsedStart && parsedEnd && parsedEnd <= parsedStart) {
        return res.status(400).json({
          success: false,
          message: "salesEnd must be after salesStart",
        });
      }

      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) {
        return res
          .status(404)
          .json({ success: false, message: "Event not found" });
      }

      const ticketType = await prisma.ticketType.create({
        data: {
          eventId,
          name,
          price: parseFloat(price),
          quantity: parseInt(quantity, 10),
          salesStart: parsedStart,
          salesEnd: parsedEnd,
        },
      });

      return res.status(201).json({
        success: true,
        data: serializeTicketType(ticketType),
      });
    } catch (error) {
      console.error("Error creating ticket type:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  if (req.method === "DELETE") {
    if (!(await requirePermission(req, res, "tickets:write"))) return;
    try {
      const rawUrl = req.url ?? "";
      const q = rawUrl.includes("?")
        ? new URLSearchParams(rawUrl.slice(rawUrl.indexOf("?") + 1))
        : new URLSearchParams();
      const ticketTypeId = parseInt(q.get("id") || "", 10);
      if (isNaN(ticketTypeId)) {
        return res.status(400).json({
          success: false,
          message: "id query param (ticket type id) is required",
        });
      }

      const existing = await prisma.ticketType.findFirst({
        where: { id: ticketTypeId, eventId },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Ticket type not found" });
      }

      await prisma.ticketType.delete({ where: { id: ticketTypeId } });
      return res
        .status(200)
        .json({ success: true, message: "Ticket type deleted", data: null });
    } catch (error) {
      console.error("Error deleting ticket type:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "DELETE"]);
  return res
    .status(405)
    .json({ success: false, message: `Method ${req.method} Not Allowed` });
}
