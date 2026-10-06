import type { NextApiRequest, NextApiResponse } from "next";
import type { Event, EventStatus, TicketType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";
import { promoteEventStatus } from "@/lib/events";

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
  try {
    switch (req.method) {
      case "GET": {
        if (!(await requirePermission(req, res, "events:read"))) return;

        const events = await prisma.event.findMany({
          orderBy: { startsAt: "desc" },
          include: {
            ticketTypes: { orderBy: { price: "asc" } },
          },
        });

        const now = new Date();
        for (const event of events) {
          await promoteEventStatus(event, now);
        }

        return res.status(200).json({
          success: true,
          data: events.map(serializeEvent),
        });
      }

      case "POST": {
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
          ticketTypes,
        } = req.body;

        if (!title || !startsAt) {
          return res.status(400).json({
            success: false,
            message: "title and startsAt are required",
          });
        }

        // Status is time-driven: staff may only set CANCELLED (manual) or
        // PUBLISHED via "publish now". COMPLETED is never settable here.
        let eventStatus: EventStatus = "DRAFT";
        let storedPublishAt: Date | null = publishAt
          ? new Date(publishAt)
          : null;
        if (status === "CANCELLED") {
          eventStatus = "CANCELLED";
          storedPublishAt = null;
        } else if (status === "PUBLISHED") {
          eventStatus = "PUBLISHED";
          storedPublishAt = null;
        }

        const eventSlug = slug || slugify(title);

        // Inline ticket types get the same validation as the dedicated
        // ticket-type routes: no negative/NaN price or quantity, and a sane
        // sales window.
        const inlineTickets = (ticketTypes ?? []).map(
          (tt: {
            name: string;
            price: number | string;
            quantity: number;
            salesStart?: string | null;
            salesEnd?: string | null;
          }) => {
            const price =
              typeof tt.price === "number" ? tt.price : parseFloat(tt.price);
            const quantity =
              typeof tt.quantity === "number" ? tt.quantity : Number(tt.quantity);
            const salesStart = tt.salesStart ? new Date(tt.salesStart) : null;
            const salesEnd = tt.salesEnd ? new Date(tt.salesEnd) : null;
            return { name: tt.name, price, quantity, salesStart, salesEnd };
          }
        );
        for (const tt of inlineTickets) {
          if (!tt.name || !Number.isFinite(tt.price) || tt.price < 0) {
            return res.status(400).json({
              success: false,
              message: "Each ticket type needs a name and a price of 0 or more.",
            });
          }
          if (!Number.isInteger(tt.quantity) || tt.quantity < 0) {
            return res.status(400).json({
              success: false,
              message: `Ticket type "${tt.name}" needs a whole-number quantity of 0 or more.`,
            });
          }
          if (
            tt.salesStart &&
            tt.salesEnd &&
            (isNaN(tt.salesStart.getTime()) ||
              isNaN(tt.salesEnd.getTime()) ||
              tt.salesEnd <= tt.salesStart)
          ) {
            return res.status(400).json({
              success: false,
              message: `Ticket type "${tt.name}" needs salesEnd after salesStart.`,
            });
          }
          if (
            (tt.salesStart && isNaN(tt.salesStart.getTime())) ||
            (tt.salesEnd && isNaN(tt.salesEnd.getTime()))
          ) {
            return res.status(400).json({
              success: false,
              message: `Ticket type "${tt.name}" has an invalid sales date.`,
            });
          }
        }

        const created = await prisma.event.create({
          data: {
            title,
            slug: eventSlug,
            description: description ?? null,
            venue: venue ?? null,
            imageUrl: imageUrl ?? null,
            startsAt: new Date(startsAt),
            endsAt: endsAt ? new Date(endsAt) : null,
            publishAt: storedPublishAt,
            status: eventStatus,
            directions: directions ?? null,
            openingHours: openingHours ?? null,
            artistTalkAt: artistTalkAt ? new Date(artistTalkAt) : null,
            ticketTypes: inlineTickets.length
              ? { create: inlineTickets }
              : undefined,
          },
          include: {
            ticketTypes: { orderBy: { price: "asc" } },
          },
        });

        return res.status(201).json({
          success: true,
          data: serializeEvent(created),
        });
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({
          success: false,
          message: `Method ${req.method} Not Allowed`,
        });
    }
  } catch (error) {
    console.error("Error handling events:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
