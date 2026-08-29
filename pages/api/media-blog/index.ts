import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import {
  APIResponse,
  MediaBlogEntryWithRelations,
  APIError,
  convertPrismaMediaBlogEntryWithRelationsToAPI,
} from "@/types/api";
import { MediaBlogEntryType, MediaFileType } from "@prisma/client";
import { requirePermission } from "@/lib/require-permission";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    | APIResponse<MediaBlogEntryWithRelations | MediaBlogEntryWithRelations[]>
    | APIError
  >
) {
  try {
    switch (req.method) {
      case "GET": {
        if (!(await requirePermission(req, res, "artworks:read"))) return;

        const mediaBlogEntries = await prisma.mediaBlogEntry.findMany({
          include: {
            mediaFiles: { orderBy: { order: "asc" } },
          },
          orderBy: { createdAt: "desc" },
        });

        return res.status(200).json({
          success: true,
          data: mediaBlogEntries.map(
            convertPrismaMediaBlogEntryWithRelationsToAPI
          ),
        });
      }

      case "POST": {
        if (!(await requirePermission(req, res, "artworks:write"))) return;

        const { mediaFiles, ...entryData } = req.body;

        const newEntry = await prisma.$transaction(async (tx) => {
          const createdEntry = await tx.mediaBlogEntry.create({
            data: {
              title: entryData.title,
              shortDesc: entryData.shortDesc,
              type: entryData.type as MediaBlogEntryType,
              externalLink: entryData.externalLink,
              mediaFiles: {
                create: (mediaFiles || []).map(
                  (
                    mf: {
                      url: string;
                      type: string;
                      description?: string | null;
                      thumbnailUrl?: string | null;
                    },
                    index: number
                  ) => ({
                    url: mf.url,
                    type: mf.type as MediaFileType,
                    description: mf.description,
                    thumbnailUrl: mf.thumbnailUrl,
                    order: index,
                  })
                ),
              },
            },
            include: {
              mediaFiles: { orderBy: { order: "asc" } },
            },
          });
          return createdEntry;
        });

        return res.status(201).json({
          success: true,
          data: convertPrismaMediaBlogEntryWithRelationsToAPI(newEntry),
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
    console.error("Error handling media blog API:", error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message || "Internal server error",
    });
  }
}
