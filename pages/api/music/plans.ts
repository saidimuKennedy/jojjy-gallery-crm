import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    switch (req.method) {
      case "GET": {
        if (!(await requirePermission(req, res, "music:read"))) return;
        const plans = await prisma.membershipPlan.findMany({
          orderBy: { createdAt: "desc" },
        });
        return res.status(200).json({
          success: true,
          data: plans.map((p) => ({
            ...p,
            price: Number(p.price),
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
          })),
        });
      }

      case "POST": {
        if (!(await requirePermission(req, res, "music:write"))) return;
        const { name, description, price, currency, durationDays, active } =
          req.body;
        if (!name || price == null || !durationDays) {
          return res.status(400).json({
            success: false,
            message: "name, price, and durationDays are required",
          });
        }
        const plan = await prisma.membershipPlan.create({
          data: {
            name,
            description: description ?? null,
            price: Number(price),
            currency: currency || "KES",
            durationDays: Number(durationDays),
            active: active !== false,
          },
        });
        return res.status(201).json({
          success: true,
          data: { ...plan, price: Number(plan.price) },
        });
      }

      case "PUT": {
        if (!(await requirePermission(req, res, "music:write"))) return;
        const id = Number(req.body?.id);
        if (!Number.isFinite(id)) {
          return res.status(400).json({ success: false, message: "id required" });
        }
        const plan = await prisma.membershipPlan.update({
          where: { id },
          data: {
            name: req.body.name,
            description: req.body.description,
            price:
              req.body.price != null ? Number(req.body.price) : undefined,
            currency: req.body.currency,
            durationDays:
              req.body.durationDays != null
                ? Number(req.body.durationDays)
                : undefined,
            active:
              req.body.active !== undefined ? !!req.body.active : undefined,
          },
        });
        return res.status(200).json({
          success: true,
          data: { ...plan, price: Number(plan.price) },
        });
      }

      default:
        res.setHeader("Allow", ["GET", "POST", "PUT"]);
        return res
          .status(405)
          .json({ success: false, message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("CRM membership plans", error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message || "Plans API error",
    });
  }
}
