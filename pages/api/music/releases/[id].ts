import type { NextApiRequest, NextApiResponse } from "next";
import type { MusicAccessMode, MusicPublishStatus, MusicReleaseType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const id = Number(req.query.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  try {
    switch (req.method) {
      case "GET": {
        if (!(await requirePermission(req, res, "music:read"))) return;
        const release = await prisma.release.findUnique({
          where: { id },
          include: {
            accessPolicy: true,
            tracks: { orderBy: { trackNumber: "asc" } },
            _count: { select: { unlocks: true } },
          },
        });
        if (!release) {
          return res
            .status(404)
            .json({ success: false, message: "Release not found" });
        }
        return res.status(200).json({
          success: true,
          data: {
            ...release,
            publishAt: release.publishAt?.toISOString() ?? null,
            releaseDate: release.releaseDate?.toISOString() ?? null,
            createdAt: release.createdAt.toISOString(),
            updatedAt: release.updatedAt.toISOString(),
            accessPolicy: release.accessPolicy
              ? {
                  ...release.accessPolicy,
                  price: release.accessPolicy.price
                    ? Number(release.accessPolicy.price)
                    : null,
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
            unlockCount: release._count.unlocks,
          },
        });
      }

      case "PUT": {
        if (!(await requirePermission(req, res, "music:write"))) return;

        const existing = await prisma.release.findUnique({
          where: { id },
          include: { accessPolicy: true, tracks: true, _count: { select: { unlocks: true } } },
        });
        if (!existing) {
          return res
            .status(404)
            .json({ success: false, message: "Release not found" });
        }

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

        const nextStatus = (publishStatus as MusicPublishStatus) || existing.publishStatus;

        if (
          (nextStatus === "PUBLISHED" || nextStatus === "SCHEDULED") &&
          existing.tracks.length === 0
        ) {
          return res.status(400).json({
            success: false,
            message: "Add at least one track before publishing",
          });
        }

        const becomingPublic =
          (nextStatus === "PUBLISHED" || nextStatus === "SCHEDULED") &&
          existing.publishStatus !== "PUBLISHED" &&
          existing.publishStatus !== "SCHEDULED";

        if (becomingPublic) {
          if (!(await requirePermission(req, res, "music:publish"))) return;
        }
        if (nextStatus === "ARCHIVED" && existing.publishStatus !== "ARCHIVED") {
          if (!(await requirePermission(req, res, "music:archive"))) return;
        }

        if (existing._count.unlocks > 0 && req.body?.hardDelete) {
          return res.status(400).json({
            success: false,
            message: "Cannot delete a purchased release; archive instead",
          });
        }

        const mode =
          (accessMode as MusicAccessMode) ||
          existing.accessPolicy?.accessMode ||
          "PAID";

        const updated = await prisma.release.update({
          where: { id },
          data: {
            title: title ?? existing.title,
            slug: slug ?? existing.slug,
            description:
              description !== undefined ? description : existing.description,
            coverImage:
              coverImage !== undefined ? coverImage : existing.coverImage,
            artistName: artistName ?? existing.artistName,
            releaseType:
              (releaseType as MusicReleaseType) || existing.releaseType,
            genre: genre !== undefined ? genre : existing.genre,
            publishStatus: nextStatus,
            publishAt:
              publishAt !== undefined
                ? publishAt
                  ? new Date(publishAt)
                  : null
                : existing.publishAt,
            explicit: explicit !== undefined ? !!explicit : existing.explicit,
            releaseDate:
              releaseDate !== undefined
                ? releaseDate
                  ? new Date(releaseDate)
                  : null
                : existing.releaseDate,
            accessPolicy: {
              upsert: {
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
                update: {
                  accessMode: mode,
                  price:
                    price !== undefined
                      ? price === null || price === ""
                        ? null
                        : Number(price)
                      : undefined,
                  currency: currency || undefined,
                  paidPlayLimit:
                    paidPlayLimit != null ? Number(paidPlayLimit) : undefined,
                },
              },
            },
          },
          include: {
            accessPolicy: true,
            tracks: { orderBy: { trackNumber: "asc" } },
            _count: { select: { unlocks: true } },
          },
        });

        return res.status(200).json({
          success: true,
          data: {
            ...updated,
            publishAt: updated.publishAt?.toISOString() ?? null,
            releaseDate: updated.releaseDate?.toISOString() ?? null,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
            accessPolicy: updated.accessPolicy
              ? {
                  ...updated.accessPolicy,
                  price: updated.accessPolicy.price
                    ? Number(updated.accessPolicy.price)
                    : null,
                }
              : null,
            tracks: updated.tracks.map((t) => ({
              id: t.id,
              title: t.title,
              trackNumber: t.trackNumber,
              duration: t.duration,
              hasAudio: !!t.storageKey,
            })),
            unlockCount: updated._count.unlocks,
          },
        });
      }

      case "DELETE": {
        if (!(await requirePermission(req, res, "music:write"))) return;
        const existing = await prisma.release.findUnique({
          where: { id },
          include: { _count: { select: { unlocks: true } } },
        });
        if (!existing) {
          return res
            .status(404)
            .json({ success: false, message: "Release not found" });
        }
        if (existing._count.unlocks > 0) {
          return res.status(400).json({
            success: false,
            message: "Cannot delete a purchased release; archive instead",
          });
        }
        await prisma.release.delete({ where: { id } });
        return res.status(200).json({ success: true });
      }

      default:
        res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
        return res
          .status(405)
          .json({ success: false, message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("CRM music release", error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message || "Music API error",
    });
  }
}
