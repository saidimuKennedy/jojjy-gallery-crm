import type { NextApiRequest, NextApiResponse } from "next";
import type { Event, EventStatus, TicketType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

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
          status,
          directions,
          openingHours,
          artistTalkAt,
        } = req.body;

        if (!title || !startsAt) {
          return res.status(400).json({
            success: false,
            message: "title and startsAt are required",
          });
        }

        const updated = await prisma.event.update({
          where: { id: eventId },
          data: {
            title,
            slug: slug || slugify(title),
            description: description ?? null,
            venue: venue ?? null,
            imageUrl: imageUrl ?? null,
            startsAt: new Date(startsAt),
            endsAt: endsAt ? new Date(endsAt) : null,
            status: (status as EventStatus) ?? undefined,
            directions: directions ?? null,
            openingHours: openingHours ?? null,
            artistTalkAt: artistTalkAt ? new Date(artistTalkAt) : null,
          },
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
