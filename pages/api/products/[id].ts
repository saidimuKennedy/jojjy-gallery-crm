import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";
import { validateVariants } from "@/lib/validate-variants";

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

      const checked = validateVariants(variants);
      if (checked.error) {
        return res.status(400).json({ success: false, message: checked.error });
      }

      if (Array.isArray(variants)) {
        // Variants are replaced wholesale: refuse when existing variants back
        // paid order history (their IDs would be destroyed by the replace).
        const referenced = await prisma.orderItem.count({
          where: { productVariant: { productId } },
        });
        if (referenced > 0) {
          return res.status(409).json({
            success: false,
            message:
              "This product has ordered items; variants cannot be replaced. Adjust stock instead.",
          });
        }
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
          if ((checked.variants ?? []).length > 0) {
            await tx.productVariant.createMany({
              data: (checked.variants ?? []).map((v) => ({
                productId,
                sku: v.sku,
                size: v.size,
                color: v.color,
                price: v.price,
                stock: v.stock,
              })),
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
      const referenced = await prisma.orderItem.count({
        where: { productVariant: { productId } },
      });
      if (referenced > 0) {
        return res.status(409).json({
          success: false,
          message:
            "This product has ordered items and cannot be deleted. Unpublish it instead (Available switch).",
        });
      }
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
