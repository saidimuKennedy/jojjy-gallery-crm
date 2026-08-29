import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

function serializeProduct(product: {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
  variants: {
    id: number;
    productId: number;
    sku: string;
    size: string | null;
    color: string | null;
    price: { toNumber(): number };
    stock: number;
    createdAt: Date;
    updatedAt: Date;
  }[];
}) {
  return {
    ...product,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    variants: product.variants.map((v) => ({
      ...v,
      price: v.price.toNumber(),
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    })),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    if (!(await requirePermission(req, res, "merch:read"))) return;
    try {
      const products = await prisma.product.findMany({
        orderBy: { createdAt: "desc" },
        include: { variants: { orderBy: { price: "asc" } } },
      });
      return res.status(200).json({
        success: true,
        data: products.map(serializeProduct),
      });
    } catch (error) {
      console.error("Error listing products:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  if (req.method === "POST") {
    if (!(await requirePermission(req, res, "merch:write"))) return;
    try {
      const { name, slug, description, imageUrl, category, variants } =
        req.body;

      if (!name || !slug) {
        return res.status(400).json({
          success: false,
          message: "name and slug are required",
        });
      }

      const product = await prisma.product.create({
        data: {
          name,
          slug,
          description: description || null,
          imageUrl: imageUrl || null,
          category: category || null,
          variants: {
            create: (variants || []).map(
              (v: {
                sku: string;
                size?: string | null;
                color?: string | null;
                price: number | string;
                stock?: number | string;
              }) => ({
                sku: v.sku,
                size: v.size || null,
                color: v.color || null,
                price: parseFloat(String(v.price)),
                stock: parseInt(String(v.stock ?? 0), 10),
              })
            ),
          },
        },
        include: { variants: true },
      });

      return res.status(201).json({
        success: true,
        data: serializeProduct(product),
      });
    } catch (error) {
      console.error("Error creating product:", error);
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
