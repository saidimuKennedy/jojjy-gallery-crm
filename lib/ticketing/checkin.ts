import prisma from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

export class CheckInError extends Error {
  httpStatus: number;
  code: string;
  constructor(httpStatus: number, message: string, code = "INVALID") {
    super(message);
    this.name = "CheckInError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

/**
 * Check a ticket in at the door. Atomic and idempotent: the guarded updateMany
 * succeeds for exactly one scan even under concurrent requests, so a duplicate
 * scan cannot create a second check-in. Attributed to the staff session.
 */
export async function checkInTicket(input: {
  code: string;
  eventId: number;
  crmUserId: string;
}) {
  const code = (input.code ?? "").trim().toUpperCase();
  if (!code) throw new CheckInError(400, "A ticket code is required.");

  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { code },
      include: { ticketType: { include: { event: true } } },
    });
    if (!ticket) {
      throw new CheckInError(404, "Ticket not found.", "NOT_FOUND");
    }
    if (ticket.ticketType.eventId !== input.eventId) {
      throw new CheckInError(
        409,
        "This ticket is for a different event.",
        "WRONG_EVENT"
      );
    }
    if (ticket.status === "REFUNDED") {
      throw new CheckInError(
        409,
        "This ticket was refunded and is not valid for entry.",
        "REFUNDED"
      );
    }
    if (ticket.status === "CANCELLED") {
      throw new CheckInError(409, "This ticket was cancelled.", "CANCELLED");
    }
    if (ticket.checkedInAt) {
      throw new CheckInError(
        409,
        `Already checked in at ${ticket.checkedInAt.toISOString()}.`,
        "DUPLICATE"
      );
    }

    const now = new Date();
    const updated = await tx.ticket.updateMany({
      where: { id: ticket.id, checkedInAt: null, status: "VALID" },
      data: {
        checkedInAt: now,
        checkedInByCrmUserId: input.crmUserId,
        status: "CHECKED_IN",
      },
    });
    if (updated.count === 0) {
      throw new CheckInError(409, "Already checked in.", "DUPLICATE");
    }

    await tx.ticketCheckIn.create({
      data: { ticketId: ticket.id, action: "CHECK_IN", crmUserId: input.crmUserId },
    });
    await recordAudit(tx, {
      actorCrmUserId: input.crmUserId,
      action: "ticket.check_in",
      targetType: "ticket",
      targetId: ticket.id,
      after: { code: ticket.code, eventId: input.eventId },
    });

    return tx.ticket.findUnique({
      where: { id: ticket.id },
      include: { ticketType: { include: { event: true } } },
    });
  });
}

/**
 * Reverse/correct a check-in. Appends a REVERSAL audit row (retaining the
 * original CHECK_IN row) and records who corrected it and why.
 */
export async function reverseCheckIn(input: {
  ticketId: string;
  crmUserId: string;
  reason: string;
}) {
  const reason = (input.reason ?? "").trim();
  if (!reason) {
    throw new CheckInError(400, "A reason is required to reverse a check-in.");
  }

  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { id: input.ticketId } });
    if (!ticket) throw new CheckInError(404, "Ticket not found.");
    if (!ticket.checkedInAt) {
      throw new CheckInError(409, "This ticket is not currently checked in.");
    }

    const nextStatus =
      ticket.status === "REFUNDED" || ticket.status === "CANCELLED"
        ? ticket.status
        : "VALID";

    await tx.ticket.update({
      where: { id: ticket.id },
      data: { checkedInAt: null, checkedInByCrmUserId: null, status: nextStatus },
    });
    await tx.ticketCheckIn.create({
      data: {
        ticketId: ticket.id,
        action: "REVERSAL",
        crmUserId: input.crmUserId,
        reason,
      },
    });
    await recordAudit(tx, {
      actorCrmUserId: input.crmUserId,
      action: "ticket.check_in_correct",
      targetType: "ticket",
      targetId: ticket.id,
      before: {
        checkedInAt: ticket.checkedInAt.toISOString(),
        checkedInByCrmUserId: ticket.checkedInByCrmUserId,
        status: ticket.status,
      },
      after: { checkedInAt: null, status: nextStatus },
      reason,
    });

    return tx.ticket.findUnique({ where: { id: ticket.id } });
  });
}
