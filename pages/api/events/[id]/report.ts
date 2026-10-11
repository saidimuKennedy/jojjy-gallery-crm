import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";
import { releaseExpiredTicketReservations } from "@/lib/ticketing/inventory";

/**
 * Event report. Every total is defined here and derived only from persisted
 * rows. Complimentary issuance is a count, never revenue.
 *
 * Definitions:
 *   allocated    = Σ TicketType.quantity
 *   sold         = Σ TicketType.quantitySold (paid + complimentary; consumes stock)
 *   reserved     = Σ TicketType.quantityReserved (active holds)
 *   remaining    = allocated − sold − reserved
 *   complimentary= COUNT(tickets with source COMPLIMENTARY)
 *   checkedIn    = COUNT(tickets currently CHECKED_IN)
 *   grossPaid    = Σ(PAID ONLINE order item qty × unitPrice)
 *   refunded     = Σ(PROCESSED refund amounts for orders touching this event)
 *   netPaid      = grossPaid − refunded
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

  if (!(await requirePermission(req, res, "events:read"))) return;
  if (!(await requirePermission(req, res, "reporting:read"))) return;

  const { id, format } = req.query;
  const eventId = typeof id === "string" ? parseInt(id, 10) : NaN;
  if (isNaN(eventId)) {
    return res.status(400).json({ success: false, message: "Invalid event id" });
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, slug: true, status: true, startsAt: true },
    });
    if (!event) {
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    }

    await releaseExpiredTicketReservations();

    const types = await prisma.ticketType.findMany({
      where: { eventId },
      orderBy: { price: "asc" },
    });
    const typeIds = types.map((t) => t.id);

    const tickets = typeIds.length
      ? await prisma.ticket.findMany({
          where: { ticketTypeId: { in: typeIds } },
          select: {
            id: true,
            code: true,
            ticketTypeId: true,
            source: true,
            status: true,
            holderName: true,
            holderEmail: true,
            checkedInAt: true,
            userId: true,
          },
        })
      : [];

    const paidItems = typeIds.length
      ? await prisma.orderItem.findMany({
          where: {
            ticketTypeId: { in: typeIds },
            order: { status: "PAID", source: "ONLINE" },
          },
          select: { ticketTypeId: true, quantity: true, unitPrice: true },
        })
      : [];

    const refunds = typeIds.length
      ? await prisma.refund.findMany({
          where: {
            status: "PROCESSED",
            order: { items: { some: { ticketTypeId: { in: typeIds } } } },
          },
          select: { amount: true },
        })
      : [];
    const refundedTotal = Math.round(
      refunds.reduce((s, r) => s + r.amount.toNumber(), 0) * 100
    ) / 100;

    const perType = types.map((t) => {
      const typeTickets = tickets.filter((tk) => tk.ticketTypeId === t.id);
      const items = paidItems.filter((i) => i.ticketTypeId === t.id);
      const grossPaid =
        Math.round(
          items.reduce((s, i) => s + i.quantity * i.unitPrice.toNumber(), 0) * 100
        ) / 100;
      return {
        id: t.id,
        name: t.name,
        price: t.price.toNumber(),
        allocated: t.quantity,
        sold: t.quantitySold,
        reserved: t.quantityReserved,
        remaining: Math.max(0, t.quantity - t.quantitySold - t.quantityReserved),
        complimentary: typeTickets.filter((tk) => tk.source === "COMPLIMENTARY")
          .length,
        checkedIn: typeTickets.filter((tk) => tk.status === "CHECKED_IN").length,
        refundedTickets: typeTickets.filter((tk) => tk.status === "REFUNDED")
          .length,
        grossPaid,
        currency: "USD",
        salesStart: t.salesStart ? t.salesStart.toISOString() : null,
        salesEnd: t.salesEnd ? t.salesEnd.toISOString() : null,
        archivedAt: t.archivedAt ? t.archivedAt.toISOString() : null,
      };
    });

    const grossPaidTotal =
      Math.round(perType.reduce((s, t) => s + t.grossPaid, 0) * 100) / 100;

    const totals = {
      allocated: types.reduce((s, t) => s + t.quantity, 0),
      sold: types.reduce((s, t) => s + t.quantitySold, 0),
      reserved: types.reduce((s, t) => s + t.quantityReserved, 0),
      remaining: perType.reduce((s, t) => s + t.remaining, 0),
      complimentary: perType.reduce((s, t) => s + t.complimentary, 0),
      checkedIn: perType.reduce((s, t) => s + t.checkedIn, 0),
      grossPaid: grossPaidTotal,
      refunded: refundedTotal,
      netPaid: Math.round((grossPaidTotal - refundedTotal) * 100) / 100,
      currency: "USD",
    };

    // Optional attendee/report CSV, gated on export permission.
    if (format === "csv") {
      if (!(await requirePermission(req, res, "reporting:export"))) return;
      const typeName = new Map(types.map((t) => [t.id, t.name]));
      const header = [
        "ticket_code",
        "event",
        "ticket_type",
        "holder_name",
        "holder_email",
        "source",
        "status",
        "checked_in_at",
      ];
      const rows = tickets.map((tk) => [
        tk.code,
        event.title,
        typeName.get(tk.ticketTypeId) ?? "",
        tk.holderName ?? "",
        tk.holderEmail ?? "",
        tk.source,
        tk.status,
        tk.checkedInAt ? tk.checkedInAt.toISOString() : "",
      ]);
      const csv = [header, ...rows]
        .map((r) => r.map(csvCell).join(","))
        .join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="event-${event.id}-attendees.csv"`
      );
      return res.status(200).send(csv);
    }

    return res.status(200).json({
      success: true,
      data: {
        event: { ...event, startsAt: event.startsAt.toISOString() },
        definitions: {
          allocated: "Sum of ticket-type quantities",
          sold: "Issued tickets (paid + complimentary) per tier counter",
          reserved: "Active unexpired checkout holds",
          remaining: "allocated − sold − reserved",
          complimentary: "Tickets issued as complimentary (zero revenue)",
          checkedIn: "Tickets currently checked in",
          grossPaid: "Sum of paid (online) ticket items (catalogue currency)",
          refunded: "Sum of processed refunds against this event's orders",
          netPaid: "grossPaid − refunded",
        },
        totals,
        types: perType,
      },
    });
  } catch (error) {
    console.error("Error building event report:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}

function csvCell(value: string): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
