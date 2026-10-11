import type { NextApiRequest, NextApiResponse } from "next";
import { requirePermission } from "@/lib/require-permission";
import { RefundError, listRefunds, requestRefund } from "@/lib/refunds";

function serializeRefund(r: {
  id: string;
  orderId: string;
  ticketId: string | null;
  amount: { toNumber(): number };
  currency: string;
  reason: string;
  status: string;
  providerStatus: string | null;
  paystackTransactionRef: string | null;
  paystackRefundId: string | null;
  requestedAt: Date;
  approvedAt: Date | null;
  submittedAt: Date | null;
  settledAt: Date | null;
  failureReason: string | null;
  order?: {
    id: string;
    amount: { toNumber(): number };
    currency: string;
    guestName: string | null;
    guestEmail: string | null;
    paystackRef: string | null;
    user: { email: string; username: string } | null;
  };
  requester?: { id: string; name: string | null; email: string };
  approver?: { id: string; name: string | null; email: string } | null;
  ticket?: { id: string; code: string } | null;
}) {
  return {
    id: r.id,
    orderId: r.orderId,
    ticketId: r.ticketId,
    amount: r.amount.toNumber(),
    currency: r.currency,
    reason: r.reason,
    status: r.status,
    providerStatus: r.providerStatus,
    paystackTransactionRef: r.paystackTransactionRef,
    paystackRefundId: r.paystackRefundId,
    requestedAt: r.requestedAt.toISOString(),
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
    submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    settledAt: r.settledAt ? r.settledAt.toISOString() : null,
    failureReason: r.failureReason,
    order: r.order
      ? {
          id: r.order.id,
          amount: r.order.amount.toNumber(),
          currency: r.order.currency,
          buyer:
            r.order.guestName ||
            r.order.user?.username ||
            r.order.guestEmail ||
            r.order.user?.email ||
            "Guest buyer",
          email: r.order.guestEmail ?? r.order.user?.email ?? null,
          paystackRef: r.order.paystackRef,
        }
      : null,
    requester: r.requester ?? null,
    approver: r.approver ?? null,
    ticket: r.ticket ?? null,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    if (!(await requirePermission(req, res, "orders:read"))) return;
    try {
      const { status, page, limit } = req.query;
      const result = await listRefunds({
        status: typeof status === "string" ? status : undefined,
        page: typeof page === "string" ? parseInt(page, 10) : undefined,
        limit: typeof limit === "string" ? parseInt(limit, 10) : undefined,
      });
      return res.status(200).json({
        success: true,
        data: result.rows.map(serializeRefund),
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (error) {
      console.error("Error listing refunds:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  if (req.method === "POST") {
    const auth = await requirePermission(req, res, "orders:refund-request");
    if (!auth) return;
    const { orderId, ticketId, ticketCode, amount, reason } = req.body as {
      orderId?: string;
      ticketId?: string | null;
      ticketCode?: string | null;
      amount?: number | string;
      reason?: string;
    };
    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: "orderId is required" });
    }
    try {
      const refund = await requestRefund({
        orderId,
        ticketId: ticketId ?? null,
        ticketCode: ticketCode ?? null,
        amount: typeof amount === "string" ? parseFloat(amount) : (amount ?? NaN),
        reason: reason ?? "",
        requesterCrmUserId: auth.userId,
      });
      return res.status(201).json({
        success: true,
        message: "Refund requested — a different staff member must approve it.",
        data: { id: refund.id, status: refund.status },
      });
    } catch (error) {
      if (error instanceof RefundError) {
        return res
          .status(error.httpStatus)
          .json({ success: false, message: error.message });
      }
      console.error("Error requesting refund:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res
    .status(405)
    .json({ success: false, message: `Method ${req.method} Not Allowed` });
}
