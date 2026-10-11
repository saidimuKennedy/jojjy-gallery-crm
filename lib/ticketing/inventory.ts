import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * CRM-side ticket inventory helpers. The app repo owns reservation/finalization
 * (checkout path); the CRM only needs to release expired holds before reporting
 * and to guard capacity edits.
 */

export const TICKET_RESERVATION_HOLD_MINUTES = 30;

type Client = Prisma.TransactionClient;

/** Release expired ACTIVE reservations, returning their stock to the pool. */
export async function releaseExpiredTicketReservations(
  tx: Client | typeof prisma = prisma,
  now: Date = new Date()
): Promise<number> {
  const expired = await tx.ticketReservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: now } },
    select: { id: true, ticketTypeId: true, quantity: true },
  });
  if (expired.length === 0) return 0;

  const byType = new Map<number, number>();
  for (const r of expired) {
    byType.set(r.ticketTypeId, (byType.get(r.ticketTypeId) ?? 0) + r.quantity);
  }
  await tx.ticketReservation.updateMany({
    where: { id: { in: expired.map((r) => r.id) } },
    data: { status: "RELEASED", releasedAt: now },
  });
  for (const [ticketTypeId, qty] of byType) {
    await tx.ticketType.update({
      where: { id: ticketTypeId },
      data: { quantityReserved: { decrement: qty } },
    });
  }
  return expired.length;
}

/**
 * A ticket type can only be shrunk down to what is already sold or reserved.
 * Returns an error message, or null when allowed.
 */
export function capacityEditError(
  ticketType: {
    quantity: number;
    quantitySold: number;
    quantityReserved: number;
  },
  nextQuantity: number
): string | null {
  const floor = ticketType.quantitySold + ticketType.quantityReserved;
  if (nextQuantity < floor) {
    return `Quantity cannot be lower than sold + reserved (${floor}).`;
  }
  return null;
}
