import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  switch (req.method) {
    case "GET": {
      if (!(await requirePermission(req, res, "series:read"))) return;
      try {
        const series = await prisma.series.findMany({
          orderBy: { createdAt: "desc" },
        });
        return res.status(200).json(series);
      } catch (error) {
        console.error("Error fetching series:", error);
        return res.status(500).json({ message: "Failed to fetch series" });
      }
    }

    case "POST": {
      if (!(await requirePermission(req, res, "series:write"))) return;
      try {
        const { name, description, introduction, artistStatement, filmUrl } =
          req.body;

        if (!name) {
          return res.status(400).json({ message: "Series name is required." });
        }

        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-*|-*$/g, "");

        const newSeries = await prisma.series.create({
          data: {
            name,
            slug,
            description: description || "",
            introduction: introduction || null,
            artistStatement: artistStatement || null,
            filmUrl: filmUrl || null,
          },
        });
        return res.status(201).json(newSeries);
      } catch (error) {
        console.error("Error creating series:", error);
        return res.status(500).json({ message: "Failed to create series" });
      }
    }

    case "PUT": {
      if (!(await requirePermission(req, res, "series:write"))) return;
      try {
        const {
          id,
          name,
          description,
          introduction,
          artistStatement,
          filmUrl,
        } = req.body;

        if (!id || typeof id !== "number") {
          return res
            .status(400)
            .json({ message: "Series ID is required and must be a number." });
        }
        if (!name) {
          return res.status(400).json({ message: "Series name is required." });
        }

        const updatedSeries = await prisma.series.update({
          where: { id },
          data: {
            name,
            description: description || "",
            introduction: introduction || null,
            artistStatement: artistStatement || null,
            filmUrl: filmUrl || null,
          },
        });
        return res.status(200).json(updatedSeries);
      } catch (error) {
        console.error("Error updating series:", error);
        if ((error as { code?: string }).code === "P2025") {
          return res.status(404).json({ message: "Series not found." });
        }
        return res.status(500).json({ message: "Failed to update series" });
      }
    }

    case "DELETE": {
      if (!(await requirePermission(req, res, "series:write"))) return;
      try {
        const { id } = req.query;

        if (!id || isNaN(Number(id))) {
          return res
            .status(400)
            .json({ message: "Series ID is required and must be a number." });
        }

        const artworksInSeries = await prisma.artwork.count({
          where: { seriesId: Number(id) },
        });

        if (artworksInSeries > 0) {
          return res.status(409).json({
            message:
              "Cannot delete series: It still contains artworks. Please reassign or delete artworks first.",
          });
        }

        await prisma.series.delete({
          where: { id: Number(id) },
        });
        return res.status(204).end();
      } catch (error) {
        console.error("Error deleting series:", error);
        if ((error as { code?: string }).code === "P2025") {
          return res.status(404).json({ message: "Series not found." });
        }
        return res.status(500).json({ message: "Failed to delete series" });
      }
    }

    default:
      res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
