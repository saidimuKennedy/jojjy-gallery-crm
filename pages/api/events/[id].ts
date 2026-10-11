import type { NextApiRequest, NextApiResponse } from "next";
import type { Event, EventStatus, Prisma, TicketType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";
import { promoteEventStatus } from "@/lib/events";
import { capacityEditError } from "@/lib/ticketing/inventory";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-*|-*$/g, "");
}

function serializeEvent(
  event: Event & { ticketTypes?: TicketType[] }
) {
  return {
    ...event,
    publishAt: event.publishAt ? event.publishAt.toISOString() : null,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt ? event.endsAt.toISOString() : null,
    artistTalkAt: event.artistTalkAt
      ? event.artistTalkAt.toISOString()
      : null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    ticketTypes: event.ticketTypes?.map((tt) => ({
      ...tt,
      price: tt.price.toNumber(),
      salesStart: tt.salesStart ? tt.salesStart.toISOString() : null,
      salesEnd: tt.salesEnd ? tt.salesEnd.toISOString() : null,
      createdAt: tt.createdAt.toISOString(),
      updatedAt: tt.updatedAt.toISOString(),
    })),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "Invalid event ID" });
  }
  const eventId = parseInt(id);
  if (isNaN(eventId)) {
    return res
      .status(400)
      .json({ success: false, message: "Event ID must be a number" });
  }

  try {
    switch (req.method) {
      case "GET": {
        if (!(await requirePermission(req, res, "events:read"))) return;

        const event = await prisma.event.findUnique({
          where: { id: eventId },
          include: {
            ticketTypes: { orderBy: { price: "asc" } },
          },
        });

        if (!event) {
          return res
            .status(404)
            .json({ success: false, message: "Event not found" });
        }

        await promoteEventStatus(event);

        return res.status(200).json({
          success: true,
          data: serializeEvent(event),
        });
      }

      case "PUT": {
        if (!(await requirePermission(req, res, "events:write"))) return;

        const {
          title,
          slug,
          description,
          venue,
          imageUrl,
          startsAt,
          endsAt,
          publishAt,
          status,
          directions,
          openingHours,
          artistTalkAt,
          ticketMode,
          ticketTypes,
        } = req.body;

        if (!title || !startsAt) {
          return res.status(400).json({
            success: false,
            message: "title and startsAt are required",
          });
        }

        // Status is time-driven: staff may only set CANCELLED (manual cancel)
        // or PUBLISHED via "publish now". COMPLETED is never settable here and
        // any other status is left alone so the read-path promotion owns it.
        const data: Prisma.EventUpdateInput = {
          title,
          slug: slug || slugify(title),
          description: description ?? null,
          venue: venue ?? null,
          imageUrl: imageUrl ?? null,
          startsAt: new Date(startsAt),
          endsAt: endsAt ? new Date(endsAt) : null,
          publishAt: publishAt ? new Date(publishAt) : null,
          directions: directions ?? null,
          openingHours: openingHours ?? null,
          artistTalkAt: artistTalkAt ? new Date(artistTalkAt) : null,
        };
        if (ticketMode === "RSVP_ONLY" || ticketMode === "TICKETED") {
          data.ticketMode = ticketMode;
        }
        if (status === "CANCELLED") {
          data.status = "CANCELLED";
          data.publishAt = null;
        } else if (status === "PUBLISHED") {
          data.status = "PUBLISHED";
          data.publishAt = null;
        }

        // Reconcile inline ticket types in one transaction (create / update /
        // archive). Deletion is only allowed when a tier has no sales or
        // active reservations; otherwise it is archived to preserve history.
        const incoming = Array.isArray(ticketTypes)
          ? (ticketTypes as {
              id?: number;
              name?: string;
              description?: string | null;
              price?: number | string;
              quantity?: number | string;
              salesStart?: string | null;
              salesEnd?: string | null;
            }[])
          : undefined;

        if (incoming !== undefined) {
          const normalized: {
            id?: number;
            name: string;
            description: string | null;
            price: number;
            quantity: number;
            salesStart: Date | null;
            salesEnd: Date | null;
          }[] = [];

          for (const tt of incoming) {
            const price =
              typeof tt.price === "number" ? tt.price : parseFloat(String(tt.price));
            const quantity =
              typeof tt.quantity === "number"
                ? tt.quantity
                : Number(tt.quantity);
            if (!tt.name || !tt.name.trim()) {
              return res.status(400).json({
                success: false,
                message: "Each ticket type needs a name.",
              });
            }
            if (!Number.isFinite(price) || price < 0) {
              return res.status(400).json({
                success: false,
                message: `Ticket type "${tt.name}" needs a price of 0 or more.`,
              });
            }
            if (!Number.isInteger(quantity) || quantity < 0) {
              return res.status(400).json({
                success: false,
                message: `Ticket type "${tt.name}" needs a whole-number quantity of 0 or more.`,
              });
            }
            const salesStart = tt.salesStart ? new Date(tt.salesStart) : null;
            const salesEnd = tt.salesEnd ? new Date(tt.salesEnd) : null;
            if (
              (salesStart && isNaN(salesStart.getTime())) ||
              (salesEnd && isNaN(salesEnd.getTime()))
            ) {
              return res.status(400).json({
                success: false,
                message: `Ticket type "${tt.name}" has an invalid sales date.`,
              });
            }
            if (salesStart && salesEnd && salesEnd <= salesStart) {
              return res.status(400).json({
                success: false,
                message: `Ticket type "${tt.name}" needs salesEnd after salesStart.`,
              });
            }
            normalized.push({
              id: tt.id,
              name: tt.name.trim(),
              description:
                typeof tt.description === "string" && tt.description.trim()
                  ? tt.description.trim().slice(0, 1000)
                  : null,
              price,
              quantity,
              salesStart,
              salesEnd,
            });
          }

          const existingTypes = await prisma.ticketType.findMany({
            where: { eventId },
          });
          const keepIds = new Set(
            normalized
              .map((t) => t.id)
              .filter((id): id is number => typeof id === "number")
          );

          for (const t of normalized) {
            if (t.id !== undefined) {
              const existing = existingTypes.find((e) => e.id === t.id);
              if (!existing) {
                return res.status(404).json({
                  success: false,
                  message: `Ticket type ${t.id} does not belong to this event.`,
                });
              }
              const guard = capacityEditError(existing, t.quantity);
              if (guard) {
                return res.status(409).json({
                  success: false,
                  message: `"${t.name}": ${guard}`,
                });
              }
            }
          }

          await prisma.$transaction(async (tx) => {
            await tx.event.update({ where: { id: eventId }, data });

            for (const t of normalized) {
              if (t.id !== undefined) {
                await tx.ticketType.update({
                  where: { id: t.id },
                  data: {
                    name: t.name,
                    description: t.description,
                    price: t.price,
                    quantity: t.quantity,
                    salesStart: t.salesStart,
                    salesEnd: t.salesEnd,
                  },
                });
              } else {
                await tx.ticketType.create({
                  data: {
                    eventId,
                    name: t.name,
                    description: t.description,
                    price: t.price,
                    quantity: t.quantity,
                    salesStart: t.salesStart,
                    salesEnd: t.salesEnd,
                  },
                });
              }
            }

            // Tiers removed by staff: delete when unsold/unreserved, archive
            // otherwise so sales history is never destroyed.
            const removed = existingTypes.filter((e) => !keepIds.has(e.id));
            for (const e of removed) {
              if (e.quantitySold > 0 || e.quantityReserved > 0) {
                await tx.ticketType.update({
                  where: { id: e.id },
                  data: { archivedAt: new Date() },
                });
              } else {
                await tx.ticketType.delete({ where: { id: e.id } });
              }
            }
          });

          const reloaded = await prisma.event.findUnique({
            where: { id: eventId },
            include: { ticketTypes: { orderBy: { price: "asc" } } },
          });
          return res.status(200).json({
            success: true,
            data: reloaded ? serializeEvent(reloaded) : null,
          });
        }

        const updated = await prisma.event.update({
          where: { id: eventId },
          data,
          include: {
            ticketTypes: { orderBy: { price: "asc" } },
          },
        });

        return res.status(200).json({
          success: true,
          data: serializeEvent(updated),
        });
      }

      case "DELETE": {
        if (!(await requirePermission(req, res, "events:write"))) return;

        await prisma.event.delete({ where: { id: eventId } });
        return res.status(200).json({
          success: true,
          message: "Event deleted successfully",
          data: null,
        });
      }

      default:
        res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
        return res.status(405).json({
          success: false,
          message: `Method ${req.method} Not Allowed`,
        });
    }
  } catch (error) {
    console.error("Error handling event:", error);
    if ((error as { code?: string }).code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    }
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
