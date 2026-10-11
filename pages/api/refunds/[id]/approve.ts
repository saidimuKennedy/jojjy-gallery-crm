import type { NextApiRequest, NextApiResponse } from "next";
import { requirePermission } from "@/lib/require-permission";
import { RefundError, approveRefund } from "@/lib/refunds";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const auth = await requirePermission(req, res, "orders:refund-approve");
  if (!auth) return;

  const { id } = req.query;
  const refundId = typeof id === "string" ? id : "";
  if (!refundId) {
    return res.status(400).json({ success: false, message: "Invalid refund id" });
  }

  try {
    const refund = await approveRefund({
      refundId,
      approverCrmUserId: auth.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Refund approved and submitted to Paystack.",
      data: { id: refund?.id, status: refund?.status },
    });
  } catch (error) {
    if (error instanceof RefundError) {
      return res
        .status(error.httpStatus)
        .json({ success: false, message: error.message });
    }
    console.error("Error approving refund:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}
