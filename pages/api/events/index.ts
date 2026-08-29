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

        const eventSlug = slug || slugify(title);

        const created = await prisma.event.create({
          data: {
            title,
            slug: eventSlug,
            description: description ?? null,
            venue: venue ?? null,
            imageUrl: imageUrl ?? null,
            startsAt: new Date(startsAt),
            endsAt: endsAt ? new Date(endsAt) : null,
            status: (status as EventStatus) ?? "DRAFT",
            directions: directions ?? null,
            openingHours: openingHours ?? null,
            artistTalkAt: artistTalkAt ? new Date(artistTalkAt) : null,
            ticketTypes: ticketTypes?.length
              ? {
                  create: ticketTypes.map(
                    (tt: {
                      name: string;
                      price: number | string;
                      quantity: number;
                      salesStart?: string | null;
                      salesEnd?: string | null;
                    }) => ({
                      name: tt.name,
                      price: parseFloat(String(tt.price)),
                      quantity: Number(tt.quantity),
                      salesStart: tt.salesStart
                        ? new Date(tt.salesStart)
                        : null,
                      salesEnd: tt.salesEnd ? new Date(tt.salesEnd) : null,
                    })
                  ),
                }
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
