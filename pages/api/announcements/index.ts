import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";
import { resolvePublishedAt } from "@/lib/announcements";

function serializeAnnouncement(a: {
  id: number;
  title: string;
  body: string;
  eventId: number | null;
  publishedAt: Date | null;
  emailSentAt: Date | null;
  whatsappSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  event?: { id: number; title: string; slug: string } | null;
}) {
  return {
    ...a,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    emailSentAt: a.emailSentAt ? a.emailSentAt.toISOString() : null,
    whatsappSentAt: a.whatsappSentAt ? a.whatsappSentAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    if (!(await requirePermission(req, res, "announcements:read"))) return;
    try {
      const announcements = await prisma.announcement.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          event: { select: { id: true, title: true, slug: true } },
        },
      });
      return res.status(200).json({
        success: true,
        data: announcements.map(serializeAnnouncement),
      });
    } catch (error) {
      console.error("Error listing announcements:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  if (req.method === "POST") {
    if (!(await requirePermission(req, res, "announcements:write"))) return;
    try {
      const { title, body, eventId, publishedAt, publish } = req.body ?? {};
      if (!title || !body) {
        return res.status(400).json({
          success: false,
          message: "title and body are required",
        });
      }

      const announcement = await prisma.announcement.create({
        data: {
          title,
          body,
          eventId: eventId ? parseInt(String(eventId), 10) : null,
          publishedAt: resolvePublishedAt({ publish, publishedAt }, null),
        },
        include: {
          event: { select: { id: true, title: true, slug: true } },
        },
      });

      return res.status(201).json({
        success: true,
        data: serializeAnnouncement(announcement),
      });
    } catch (error) {
      console.error("Error creating announcement:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res
    .status(405)
    .json({ success: false, message: `Method ${req.method} Not Allowed` });
}
