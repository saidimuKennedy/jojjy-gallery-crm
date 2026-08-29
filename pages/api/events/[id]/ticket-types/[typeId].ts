import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
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
  const { id, typeId } = req.query;
  const eventId = typeof id === "string" ? parseInt(id, 10) : NaN;
  const ticketTypeId =
    typeof typeId === "string" ? parseInt(typeId, 10) : NaN;

  if (isNaN(eventId) || isNaN(ticketTypeId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid event or ticket type id" });
  }

  if (req.method === "PUT") {
    if (!(await requirePermission(req, res, "tickets:write"))) return;

    try {
      const existing = await prisma.ticketType.findFirst({
        where: { id: ticketTypeId, eventId },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Ticket type not found" });
      }

      const { name, price, quantity, salesStart, salesEnd } = req.body as {
        name?: string;
        price?: number | string;
        quantity?: number | string;
        salesStart?: string | null;
        salesEnd?: string | null;
      };

      const data: {
        name?: string;
        price?: number;
        quantity?: number;
        salesStart?: Date | null;
        salesEnd?: Date | null;
      } = {};

      if (name !== undefined) {
        if (!name.trim()) {
          return res
            .status(400)
            .json({ success: false, message: "name cannot be empty" });
        }
        data.name = name.trim();
      }

      if (price !== undefined) {
        const parsed = parseFloat(String(price));
        if (isNaN(parsed) || parsed < 0) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid price" });
        }
        data.price = parsed;
      }

      if (quantity !== undefined) {
        const parsed = parseInt(String(quantity), 10);
        if (isNaN(parsed) || parsed < existing.quantitySold) {
          return res.status(400).json({
            success: false,
            message: `quantity must be at least ${existing.quantitySold} (already sold)`,
          });
        }
        data.quantity = parsed;
      }

      const parsedStart = parseOptionalDate(salesStart);
      const parsedEnd = parseOptionalDate(salesEnd);
      if (salesStart !== undefined && parsedStart === undefined) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid salesStart" });
      }
      if (salesEnd !== undefined && parsedEnd === undefined) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid salesEnd" });
      }
      if (parsedStart !== undefined) data.salesStart = parsedStart;
      if (parsedEnd !== undefined) data.salesEnd = parsedEnd;

      const nextStart =
        data.salesStart !== undefined ? data.salesStart : existing.salesStart;
      const nextEnd =
        data.salesEnd !== undefined ? data.salesEnd : existing.salesEnd;
      if (nextStart && nextEnd && nextEnd <= nextStart) {
        return res.status(400).json({
          success: false,
          message: "salesEnd must be after salesStart",
        });
      }

      const ticketType = await prisma.ticketType.update({
        where: { id: ticketTypeId },
        data,
      });

      return res.status(200).json({
        success: true,
        data: serializeTicketType(ticketType),
      });
    } catch (error) {
      console.error("Error updating ticket type:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  res.setHeader("Allow", ["PUT"]);
  return res
    .status(405)
    .json({ success: false, message: `Method ${req.method} Not Allowed` });
}
