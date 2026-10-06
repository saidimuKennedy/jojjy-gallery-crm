import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import {
  APIResponse,
  ArtworkWithRelations,
  APIError,
  convertPrismaArtworkWithRelationsToAPI,
} from "@/types/api";
import { requirePermission } from "@/lib/require-permission";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<APIResponse<ArtworkWithRelations | null> | APIError>
) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "Invalid artwork ID" });
  }
  const artworkId = parseInt(id);
  if (isNaN(artworkId)) {
    return res
      .status(400)
      .json({ success: false, message: "Artwork ID must be a number" });
  }

  try {
    switch (req.method) {
      case "PUT": {
        if (!(await requirePermission(req, res, "artworks:write"))) return;

        const { mediaFiles, ...artworkData } = req.body;

        const {
          title,
          artist,
          category,
          price,
          imageUrl,
          description,
          dimensions,
          isAvailable,
          status,
          medium,
          year,
          inGallery,
          seriesId,
        } = artworkData;

        if (
          !title ||
          !artist ||
          !category ||
          price === undefined ||
          price === null ||
          !imageUrl ||
          !medium ||
          year === undefined ||
          year === null
        ) {
          return res.status(400).json({
            success: false,
            message: "Missing or invalid required artwork fields.",
          });
        }

        const updatedArtwork = await prisma.$transaction(async (tx) => {
          const existing = await tx.artwork.findUnique({
            where: { id: artworkId },
          });
          if (!existing) {
            throw new Error("NOT_FOUND");
          }
          await tx.artwork.update({
            where: { id: artworkId },
            data: {
              title,
              artist,
              category,
              price: parseFloat(price),
              imageUrl,
              description,
              dimensions,
              // Preserve flags when omitted instead of forcing defaults, so a
              // partial update can never accidentally (un)publish.
              isAvailable: isAvailable ?? existing.isAvailable,
              status: status ?? existing.status,
              medium,
              year: parseInt(year),
              inGallery: inGallery ?? existing.inGallery,
              seriesId:
                seriesId !== "" && seriesId !== null && seriesId !== undefined
                  ? parseInt(seriesId)
                  : null,
            },
          });

          if (Array.isArray(mediaFiles)) {
            for (const mf of mediaFiles) {
              if (
                mf.type !== "IMAGE" &&
                mf.type !== "VIDEO" &&
                mf.type !== "AUDIO"
              ) {
                throw new Error(
                  `INVALID_MEDIA_TYPE: "${mf.type}" — use IMAGE, VIDEO, or AUDIO.`
                );
              }
              if (!mf.url) {
                throw new Error("INVALID_MEDIA: every media file needs a url.");
              }
            }
            const incomingIds = new Set(
              mediaFiles.filter((mf: { id?: number }) => mf.id).map((mf: { id: number }) => mf.id)
            );
            await tx.artworkMediaFile.deleteMany({
              where: {
                artworkId,
                id: { notIn: [...incomingIds] },
              },
            });
            for (const [index, mf] of (
              mediaFiles as {
                id?: number;
                url: string;
                type: "IMAGE" | "VIDEO" | "AUDIO";
                description?: string | null;
                thumbnailUrl?: string | null;
                order?: number;
              }[]
            ).entries()) {
              if (mf.id) {
                await tx.artworkMediaFile.updateMany({
                  where: { id: mf.id, artworkId },
                  data: {
                    url: mf.url,
                    type: mf.type,
                    description: mf.description ?? null,
                    thumbnailUrl: mf.thumbnailUrl ?? null,
                    order: mf.order ?? index,
                  },
                });
              } else {
                await tx.artworkMediaFile.create({
                  data: {
                    artworkId,
                    url: mf.url,
                    type: mf.type,
                    description: mf.description ?? null,
                    thumbnailUrl: mf.thumbnailUrl ?? null,
                    order: mf.order ?? index,
                  },
                });
              }
            }
          }

          return tx.artwork.findUnique({
            where: { id: artworkId },
            include: { series: true, mediaFiles: true },
          });
        });

        if (!updatedArtwork) {
          return res.status(500).json({
            success: false,
            message: "Failed to update artwork or retrieve it after update.",
          });
        }

        return res.status(200).json({
          success: true,
          data: convertPrismaArtworkWithRelationsToAPI(updatedArtwork),
        });
      }

      case "DELETE": {
        if (!(await requirePermission(req, res, "artworks:write"))) return;

        const referenced = await prisma.orderItem.count({
          where: { artworkId },
        });
        if (referenced > 0) {
          return res.status(409).json({
            success: false,
            message:
              "This artwork has ordered items and cannot be deleted. Mark it Sold instead.",
          });
        }
        await prisma.artwork.delete({
          where: { id: artworkId },
        });
        return res.status(200).json({
          success: true,
          message: "Artwork deleted successfully",
          data: null,
        });
      }

      default:
        res.setHeader("Allow", ["PUT", "DELETE"]);
        return res.status(405).json({
          success: false,
          message: `Method ${req.method} Not Allowed for this endpoint`,
        });
    }
  } catch (error) {
    console.error("Error handling artwork:", error);
    const message = (error as Error).message || "Internal server error";
    if (message === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Artwork not found" });
    }
    if (message.startsWith("INVALID_MEDIA") || message.startsWith("INVALID_MEDIA_TYPE")) {
      return res.status(400).json({ success: false, message });
    }
    return res.status(500).json({
      success: false,
      message: (error as Error).message || "Internal server error",
    });
  }
}
