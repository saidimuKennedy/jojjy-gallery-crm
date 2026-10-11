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

      case "DELETE": {
        if (!(await requirePermission(req, res, "music:write"))) return;
        const id = Number(req.query?.id ?? req.body?.id);
        if (!Number.isFinite(id)) {
          return res.status(400).json({ success: false, message: "id required" });
        }
        // Plans back live history: refuse when memberships or order items
        // reference the plan, and deactivate instead of deleting.
        const [memberships, orderItems] = await Promise.all([
          prisma.membership.count({ where: { membershipPlanId: id } }),
          prisma.orderItem.count({ where: { membershipPlanId: id } }),
        ]);
        if (memberships > 0 || orderItems > 0) {
          return res.status(409).json({
            success: false,
            message:
              "This plan has members or order history and cannot be deleted. Deactivate it instead.",
          });
        }
        await prisma.membershipPlan.delete({ where: { id } });
        return res
          .status(200)
          .json({ success: true, message: "Plan deleted", data: null });
      }

      default:
        res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
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
