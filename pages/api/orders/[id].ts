import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "Invalid order id" });
  }

  // Mark a PAID physical order fulfilled. Payment state is never touched
  // here; fulfilment only records that the operator shipped/handed it over.
  if (req.method === "PATCH") {
    if (!(await requirePermission(req, res, "orders:write"))) return;
    try {
      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }
      if (order.status !== "PAID") {
        return res.status(409).json({
          success: false,
          message: "Only paid orders can be marked fulfilled",
        });
      }
      if (order.fulfilledAt) {
        return res.status(200).json({
          success: true,
          data: { fulfilledAt: order.fulfilledAt.toISOString() },
        });
      }
      const updated = await prisma.order.update({
        where: { id },
        data: { fulfilledAt: new Date() },
      });
      return res.status(200).json({
        success: true,
        data: { fulfilledAt: updated.fulfilledAt!.toISOString() },
      });
    } catch (error) {
      console.error("Error fulfilling order:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  res.setHeader("Allow", ["PATCH"]);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} Not Allowed`,
  });
}
