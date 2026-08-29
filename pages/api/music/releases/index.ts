import type { NextApiRequest, NextApiResponse } from "next";
import type { MusicAccessMode, MusicPublishStatus, MusicReleaseType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";
import { slugify } from "@/lib/music";

function serialize(release: {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  artistName: string;
  releaseType: MusicReleaseType;
  genre: string | null;
  publishStatus: MusicPublishStatus;
  publishAt: Date | null;
  explicit: boolean;
  releaseDate: Date | null;
  playCount: number;
  createdAt: Date;
  updatedAt: Date;
  accessPolicy: {
    accessMode: MusicAccessMode;
    price: { toNumber(): number } | null;
    currency: string;
    paidPlayLimit: number;
  } | null;
  tracks: {
    id: number;
    title: string;
    trackNumber: number;
    duration: number | null;
    storageKey: string;
    bitrate: number | null;
    fileSize: number | null;
  }[];
  _count?: { unlocks: number };
}) {
  return {
    id: release.id,
    slug: release.slug,
    title: release.title,
    description: release.description,
    coverImage: release.coverImage,
    artistName: release.artistName,
    releaseType: release.releaseType,
    genre: release.genre,
    publishStatus: release.publishStatus,
    publishAt: release.publishAt?.toISOString() ?? null,
    explicit: release.explicit,
    releaseDate: release.releaseDate?.toISOString() ?? null,
    playCount: release.playCount,
    unlockCount: release._count?.unlocks ?? 0,
    createdAt: release.createdAt.toISOString(),
    updatedAt: release.updatedAt.toISOString(),
    accessPolicy: release.accessPolicy
      ? {
          accessMode: release.accessPolicy.accessMode,
          price: release.accessPolicy.price
            ? release.accessPolicy.price.toNumber()
            : null,
          currency: release.accessPolicy.currency,
          paidPlayLimit: release.accessPolicy.paidPlayLimit,
        }
      : null,
    tracks: release.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      trackNumber: t.trackNumber,
      duration: t.duration,
      hasAudio: !!t.storageKey,
      bitrate: t.bitrate,
      fileSize: t.fileSize,
    })),
  };
}

const include = {
  accessPolicy: true,
  tracks: { orderBy: { trackNumber: "asc" as const } },
  _count: { select: { unlocks: true } },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    switch (req.method) {
      case "GET": {
        if (!(await requirePermission(req, res, "music:read"))) return;
        const releases = await prisma.release.findMany({
          orderBy: { updatedAt: "desc" },
          include,
        });
        return res.status(200).json({
          success: true,
          data: releases.map(serialize),
        });
      }

      case "POST": {
        if (!(await requirePermission(req, res, "music:write"))) return;

        const {
          title,
          slug,
          description,
          coverImage,
          artistName,
          releaseType,
          genre,
          publishStatus,
          publishAt,
          explicit,
          releaseDate,
          accessMode,
          price,
          currency,
          paidPlayLimit,
        } = req.body;

        if (!title) {
          return res
            .status(400)
            .json({ success: false, message: "title is required" });
        }

        const releaseSlug = slug || slugify(title);
        const mode = (accessMode as MusicAccessMode) || "PAID";

        const created = await prisma.release.create({
          data: {
            title,
            slug: releaseSlug,
            description: description ?? null,
            coverImage: coverImage ?? null,
            artistName: artistName || "Jojjy Gallery",
            releaseType: (releaseType as MusicReleaseType) || "SINGLE",
            genre: genre ?? null,
            publishStatus: (publishStatus as MusicPublishStatus) || "DRAFT",
            publishAt: publishAt ? new Date(publishAt) : null,
            explicit: !!explicit,
            releaseDate: releaseDate ? new Date(releaseDate) : null,
            accessPolicy: {
              create: {
                accessMode: mode,
                price:
                  mode === "PAID" && price != null && price !== ""
                    ? Number(price)
                    : null,
                currency: currency || "KES",
                paidPlayLimit:
                  paidPlayLimit != null ? Number(paidPlayLimit) : 3,
              },
            },
          },
          include,
        });

        return res.status(201).json({ success: true, data: serialize(created) });
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res
          .status(405)
          .json({ success: false, message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("CRM music releases", error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message || "Music API error",
    });
  }
}
