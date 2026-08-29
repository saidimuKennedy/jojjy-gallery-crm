import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const releaseId = Number(req.query.id);
  if (!Number.isFinite(releaseId)) {
    return res.status(400).json({ success: false, message: "Invalid release id" });
  }

  try {
    switch (req.method) {
      case "POST": {
        if (!(await requirePermission(req, res, "music:write"))) return;

        const release = await prisma.release.findUnique({
          where: { id: releaseId },
          include: { tracks: true },
        });
        if (!release) {
          return res
            .status(404)
            .json({ success: false, message: "Release not found" });
        }

        const { title, trackNumber, storageKey, duration, bitrate, fileSize } =
          req.body;

        if (!title || !storageKey) {
          return res.status(400).json({
            success: false,
            message: "title and storageKey are required",
          });
        }

        const number =
          trackNumber != null
            ? Number(trackNumber)
            : release.tracks.length + 1;

        const track = await prisma.track.create({
          data: {
            releaseId,
            title,
            trackNumber: number,
            storageKey,
            duration: duration != null ? Number(duration) : null,
            bitrate: bitrate != null ? Number(bitrate) : null,
            fileSize: fileSize != null ? Number(fileSize) : null,
          },
        });

        return res.status(201).json({
          success: true,
          data: {
            id: track.id,
            title: track.title,
            trackNumber: track.trackNumber,
            duration: track.duration,
            hasAudio: true,
          },
        });
      }

      case "DELETE": {
        if (!(await requirePermission(req, res, "music:write"))) return;
        const trackId = Number(req.body?.trackId ?? req.query.trackId);
        if (!Number.isFinite(trackId)) {
          return res
            .status(400)
            .json({ success: false, message: "trackId required" });
        }
        await prisma.track.deleteMany({
          where: { id: trackId, releaseId },
        });
        return res.status(200).json({ success: true });
      }

      default:
        res.setHeader("Allow", ["POST", "DELETE"]);
        return res
          .status(405)
          .json({ success: false, message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("CRM music tracks", error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message || "Track API error",
    });
  }
}
