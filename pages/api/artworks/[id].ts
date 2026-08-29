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

        const { mediaFiles: _mediaFiles, ...artworkData } = req.body;

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
              isAvailable: isAvailable ?? true,
              status: status ?? "AVAILABLE",
              medium,
              year: parseInt(year),
              inGallery: inGallery ?? false,
              seriesId:
                seriesId !== "" && seriesId !== null && seriesId !== undefined
                  ? parseInt(seriesId)
                  : null,
            },
          });

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
    return res.status(500).json({
      success: false,
      message: (error as Error).message || "Internal server error",
    });
  }
}
