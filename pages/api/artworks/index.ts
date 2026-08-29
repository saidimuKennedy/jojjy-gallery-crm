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
  res: NextApiResponse<
    APIResponse<ArtworkWithRelations | ArtworkWithRelations[]> | APIError
  >
) {
  if (req.method === "GET") {
    const auth = await requirePermission(req, res, "artworks:read");
    if (!auth) return;

    try {
      const {
        page = "1",
        limit,
        category,
        artist,
        medium,
        year,
        minPrice,
        maxPrice,
        search,
        seriesId,
        isAvailable,
        status,
        sort,
      } = req.query;

      let pageNum = 1;
      let limitNum: number | undefined;
      const skipTake: { skip?: number; take?: number } = {};

      const limitQuery = limit as string | undefined;
      if (limitQuery === "all") {
        pageNum = 1;
        limitNum = undefined;
      } else {
        let parsedLimit = parseInt(limitQuery || "10");
        if (isNaN(parsedLimit) || parsedLimit <= 0) parsedLimit = 10;
        limitNum = parsedLimit;
        pageNum = parseInt(page as string);
        if (isNaN(pageNum) || pageNum <= 0) pageNum = 1;
        skipTake.skip = (pageNum - 1) * limitNum;
        skipTake.take = limitNum;
      }

      const where: Record<string, unknown> = {};
      if (category) where.category = String(category);
      if (artist) where.artist = { contains: String(artist), mode: "insensitive" };
      if (medium) where.medium = { contains: String(medium), mode: "insensitive" };
      if (year) where.year = parseInt(year as string);
      if (isAvailable !== undefined) {
        where.isAvailable = String(isAvailable).toLowerCase() === "true";
      }
      if (status) where.status = String(status);
      if (seriesId) where.seriesId = parseInt(seriesId as string);
      if (minPrice || maxPrice) {
        const price: Record<string, number> = {};
        if (minPrice) price.gte = parseFloat(minPrice as string);
        if (maxPrice) price.lte = parseFloat(maxPrice as string);
        where.price = price;
      }
      if (search) {
        where.OR = [
          { title: { contains: String(search), mode: "insensitive" } },
          { description: { contains: String(search), mode: "insensitive" } },
          { artist: { contains: String(search), mode: "insensitive" } },
          { category: { contains: String(search), mode: "insensitive" } },
          { medium: { contains: String(search), mode: "insensitive" } },
        ];
      }

      let orderBy: Record<string, string> = { createdAt: "desc" };
      if (sort) {
        switch (sort) {
          case "price_asc":
            orderBy = { price: "asc" };
            break;
          case "price_desc":
            orderBy = { price: "desc" };
            break;
          case "name_asc":
            orderBy = { title: "asc" };
            break;
          case "name_desc":
            orderBy = { title: "desc" };
            break;
          case "year_asc":
            orderBy = { year: "asc" };
            break;
          case "year_desc":
            orderBy = { year: "desc" };
            break;
          case "views_asc":
            orderBy = { views: "asc" };
            break;
          case "views_desc":
            orderBy = { views: "desc" };
            break;
        }
      }

      const [artworks, total] = await Promise.all([
        prisma.artwork.findMany({
          where,
          orderBy,
          include: { series: true, mediaFiles: true },
          ...skipTake,
        }),
        prisma.artwork.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: artworks.map(convertPrismaArtworkWithRelationsToAPI),
        total,
      });
    } catch (error) {
      console.error("Error fetching artworks:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const auth = await requirePermission(req, res, "artworks:write");
  if (!auth) return;

  const { mediaFiles, ...artworkData } = req.body;

  try {
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

    const newArtwork = await prisma.$transaction(async (tx) => {
      const createdArtwork = await tx.artwork.create({
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
          ...(seriesId !== "" &&
            seriesId !== null && {
              series: { connect: { id: parseInt(seriesId) } },
            }),
          mediaFiles: {
            create: (mediaFiles || []).map(
              (mf: {
                url: string;
                type: string;
                description?: string | null;
                thumbnailUrl?: string | null;
                order?: number;
              }) => ({
                url: mf.url,
                type: mf.type as
                  | "IMAGE"
                  | "VIDEO"
                  | "AUDIO"
                  | "3D_MODEL"
                  | "EXTERNAL_LINK",
                description: mf.description,
                thumbnailUrl: mf.thumbnailUrl,
                order: mf.order,
              })
            ),
          },
        },
      });

      return tx.artwork.findUnique({
        where: { id: createdArtwork.id },
        include: { series: true, mediaFiles: true },
      });
    });

    if (!newArtwork) {
      return res.status(500).json({
        success: false,
        message: "Failed to create artwork or retrieve it after creation.",
      });
    }

    return res.status(201).json({
      success: true,
      data: convertPrismaArtworkWithRelationsToAPI(newArtwork),
    });
  } catch (error) {
    console.error("Error creating artwork:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
