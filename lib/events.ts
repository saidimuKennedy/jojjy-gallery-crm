import type { Event, EventStatus } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Lazy "auto-promote on read" for event status, mirroring the public site's
 * helper (jojjy-gallery-app/lib/data/events.ts) and the music release
 * scheduled-publish pattern. Only ever promotes the row already in hand:
 * - DRAFT + publishAt passed → PUBLISHED
 * - PUBLISHED + endsAt passed → COMPLETED
 * A CANCELLED event is never touched, and events with no endsAt are never
 * auto-completed (the ambiguity is left to the staff to resolve).
 */
export async function promoteEventStatus(
  event: Pick<Event, "id" | "status" | "publishAt" | "endsAt">,
  now: Date = new Date()
): Promise<Event["status"]> {
  if (event.status === "CANCELLED") return event.status;

  let next: EventStatus = event.status;
  if (
    next === "DRAFT" &&
    event.publishAt &&
    event.publishAt.getTime() <= now.getTime()
  ) {
    next = "PUBLISHED";
  } else if (
    next === "PUBLISHED" &&
    event.endsAt &&
    event.endsAt.getTime() <= now.getTime()
  ) {
    next = "COMPLETED";
  }

  if (next !== event.status) {
    await prisma.event.update({
      where: { id: event.id },
      data: { status: next },
    });
    event.status = next;
  }

  return event.status;
}
