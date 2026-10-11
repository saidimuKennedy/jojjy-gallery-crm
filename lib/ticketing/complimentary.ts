import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { generateTicketCode } from "@/lib/ticketing/codes";

export class ComplimentaryError extends Error {
  httpStatus: number;
  constructor(httpStatus: number, message: string) {
    super(message);
    this.name = "ComplimentaryError";
    this.httpStatus = httpStatus;
  }
}

export interface Attendee {
  name?: string;
  email?: string;
}

/**
 * Issue complimentary tickets. Consumes the same inventory as paid tickets,
 * creates one zero-value order + order item + one ticket row per attendee, all
 * in one transaction, and records the staff actor and required reason.
 */
export async function issueComplimentary(input: {
  eventId: number;
  ticketTypeId: number;
  reason: string;
  issuedByCrmUserId: string;
  attendees: Attendee[];
}) {
  const reason = (input.reason ?? "").trim();
  if (!reason) {
    throw new ComplimentaryError(400, "A reason is required for complimentary tickets.");
  }
  const attendees = (input.attendees ?? [])
    .map((a) => ({
      name: typeof a?.name === "string" ? a.name.trim().slice(0, 120) : "",
      email: typeof a?.email === "string" ? a.email.trim().slice(0, 200) : "",
    }))
    .filter((a) => a.name || a.email);
  if (attendees.length === 0) {
    throw new ComplimentaryError(
      400,
      "At least one attendee (name or email) is required."
    );
  }
  if (attendees.length > 200) {
    throw new ComplimentaryError(400, "Too many attendees in one issuance (max 200).");
  }
  const qty = attendees.length;

  return prisma.$transaction(async (tx) => {
    const tt = await tx.ticketType.findFirst({
      where: { id: input.ticketTypeId, eventId: input.eventId },
      include: { event: true },
    });
    if (!tt) {
      throw new ComplimentaryError(404, "Ticket type not found for this event.");
    }
    if (tt.archivedAt) {
      throw new ComplimentaryError(409, "This ticket type is archived.");
    }

    // Atomic capacity claim against sold + reserved.
    const affected = await tx.$executeRaw`
      UPDATE "ticket_types"
      SET "quantitySold" = "quantitySold" + ${qty}
      WHERE "id" = ${tt.id}
        AND "quantity" - "quantitySold" - "quantityReserved" >= ${qty}
    `;
    if (affected === 0) {
      throw new ComplimentaryError(
        409,
        `Not enough remaining allocation for ${tt.name}.`
      );
    }

    const order = await tx.order.create({
      data: {
        userId: null,
        status: "PAID",
        paymentStatus: "NOT_REQUIRED",
        source: "CRM_COMPLIMENTARY",
        paymentProvider: null,
        amount: 0,
        currency: "USD",
        issuedByCrmUserId: input.issuedByCrmUserId,
        issueReason: reason,
        items: {
          create: [
            {
              itemType: "TICKET",
              ticketTypeId: tt.id,
              quantity: qty,
              unitPrice: new Prisma.Decimal(0),
              attendees: attendees as unknown as Prisma.InputJsonValue,
            },
          ],
        },
      },
      include: { items: true },
    });

    const tickets = [];
    for (const a of attendees) {
      let code = generateTicketCode();
      for (let i = 0; i < 5; i++) {
        const exists = await tx.ticket.findUnique({ where: { code } });
        if (!exists) break;
        code = generateTicketCode();
      }
      const ticket = await tx.ticket.create({
        data: {
          ticketTypeId: tt.id,
          userId: null,
          orderId: order.id,
          code,
          source: "COMPLIMENTARY",
          holderName: a.name || null,
          holderEmail: a.email || null,
        },
      });
      tickets.push(ticket);
    }

    await recordAudit(tx, {
      actorCrmUserId: input.issuedByCrmUserId,
      action: "ticket.complimentary_issue",
      targetType: "order",
      targetId: order.id,
      after: {
        eventId: input.eventId,
        ticketTypeId: tt.id,
        quantity: qty,
        ticketIds: tickets.map((t) => t.id),
      },
      reason,
    });

    return { order, tickets };
  });
}
