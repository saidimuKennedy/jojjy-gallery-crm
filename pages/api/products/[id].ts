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
  const { id } = req.query;
  const productId = typeof id === "string" ? parseInt(id, 10) : NaN;
  if (isNaN(productId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid product id" });
  }

  if (req.method === "PUT") {
    if (!(await requirePermission(req, res, "merch:write"))) return;
    try {
      const { name, slug, description, imageUrl, category, isAvailable, variants } =
        req.body;

      if (!name || !slug) {
        return res.status(400).json({
          success: false,
          message: "name and slug are required",
        });
      }

      const product = await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: productId },
          data: {
            name,
            slug,
            description: description || null,
            imageUrl: imageUrl || null,
            category: category || null,
            isAvailable: isAvailable ?? true,
          },
        });

        if (Array.isArray(variants)) {
          await tx.productVariant.deleteMany({ where: { productId } });
          if (variants.length > 0) {
            await tx.productVariant.createMany({
              data: variants.map(
                (v: {
                  sku: string;
                  size?: string | null;
                  color?: string | null;
                  price: number | string;
                  stock?: number | string;
                }) => ({
                  productId,
                  sku: v.sku,
                  size: v.size || null,
                  color: v.color || null,
                  price: parseFloat(String(v.price)),
                  stock: parseInt(String(v.stock ?? 0), 10),
                })
              ),
            });
          }
        }

        return tx.product.findUnique({
          where: { id: productId },
          include: { variants: { orderBy: { price: "asc" } } },
        });
      });

      if (!product) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }

      return res.status(200).json({
        success: true,
        data: serializeProduct(product),
      });
    } catch (error) {
      console.error("Error updating product:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  if (req.method === "DELETE") {
    if (!(await requirePermission(req, res, "merch:write"))) return;
    try {
      await prisma.product.delete({ where: { id: productId } });
      return res
        .status(200)
        .json({ success: true, message: "Product deleted", data: null });
    } catch (error) {
      console.error("Error deleting product:", error);
      if ((error as { code?: string }).code === "P2025") {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res
    .status(405)
    .json({ success: false, message: `Method ${req.method} Not Allowed` });
}
