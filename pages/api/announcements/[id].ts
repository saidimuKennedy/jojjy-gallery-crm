import type { NextApiRequest, NextApiResponse } from "next";
import type { Announcement, Event } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";
import { resolvePublishedAt } from "@/lib/announcements";

function serializeAnnouncement(
  announcement: Announcement & { event?: Event | null }
) {
  return {
    ...announcement,
    publishedAt: announcement.publishedAt
      ? announcement.publishedAt.toISOString()
      : null,
    emailSentAt: announcement.emailSentAt
      ? announcement.emailSentAt.toISOString()
      : null,
    whatsappSentAt: announcement.whatsappSentAt
      ? announcement.whatsappSentAt.toISOString()
      : null,
    createdAt: announcement.createdAt.toISOString(),
    updatedAt: announcement.updatedAt.toISOString(),
    event: announcement.event
      ? {
          id: announcement.event.id,
          title: announcement.event.title,
          slug: announcement.event.slug,
        }
      : null,
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
      .json({ success: false, message: "Invalid announcement ID" });
  }
  const announcementId = parseInt(id);
  if (isNaN(announcementId)) {
    return res.status(400).json({
      success: false,
      message: "Announcement ID must be a number",
    });
  }

  try {
    switch (req.method) {
      case "PUT": {
        if (!(await requirePermission(req, res, "announcements:write")))
          return;

        const { title, body, eventId, publishedAt, publish } = req.body ?? {};

        if (!title || !body) {
          return res.status(400).json({
            success: false,
            message: "title and body are required",
          });
        }

        const existing = await prisma.announcement.findUnique({
          where: { id: announcementId },
        });
        if (!existing) {
          return res.status(404).json({
            success: false,
            message: "Announcement not found",
          });
        }

        const nextPublishedAt = resolvePublishedAt(
          { publish, publishedAt },
          existing.publishedAt
        );

        const updated = await prisma.announcement.update({
          where: { id: announcementId },
          data: {
            title,
            body,
            eventId:
              eventId !== undefined && eventId !== null && eventId !== ""
                ? Number(eventId)
                : null,
            publishedAt: nextPublishedAt,
          },
          include: { event: true },
        });

        return res.status(200).json({
          success: true,
          data: serializeAnnouncement(updated),
        });
      }

      case "DELETE": {
        if (!(await requirePermission(req, res, "announcements:write")))
          return;

        await prisma.announcement.delete({ where: { id: announcementId } });
        return res.status(200).json({
          success: true,
          message: "Announcement deleted successfully",
          data: null,
        });
      }

      default:
        res.setHeader("Allow", ["PUT", "DELETE"]);
        return res.status(405).json({
          success: false,
          message: `Method ${req.method} Not Allowed`,
        });
    }
  } catch (error) {
    console.error("Error handling announcement:", error);
    if ((error as { code?: string }).code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Announcement not found" });
    }
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
