import { Prisma, RefundStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  fetchRefund,
  initializeRefund,
  isPaystackConfigured,
  mapRefundStatus,
  type PaystackRefund,
} from "@/lib/paystack-refunds";

export class RefundError extends Error {
  httpStatus: number;
  constructor(httpStatus: number, message: string) {
    super(message);
    this.name = "RefundError";
    this.httpStatus = httpStatus;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Refund amounts that still count against the order's refundable balance. */
const COMMITTED: RefundStatus[] = [
  "REQUESTED",
  "APPROVED",
  "SUBMITTED",
  "PROCESSING",
  "PROCESSED",
  "NEEDS_ATTENTION",
];

function refundableRemaining(
  orderAmount: number,
  refunds: { amount: number; status: RefundStatus }[]
): number {
  const committed = refunds
    .filter((r) => COMMITTED.includes(r.status))
    .reduce((s, r) => s + r.amount, 0);
  return Math.max(0, round2(orderAmount - committed));
}

export interface RequestRefundInput {
  orderId: string;
  ticketId?: string | null;
  /** Alternative to ticketId: a door code resolved within the order. */
  ticketCode?: string | null;
  amount: number;
  reason: string;
  requesterCrmUserId: string;
}

export async function requestRefund(input: RequestRefundInput) {
  const reason = (input.reason ?? "").trim();
  if (!reason) throw new RefundError(400, "A reason is required.");
  const amount = round2(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RefundError(400, "Refund amount must be greater than zero.");
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { refunds: true },
    });
    if (!order) throw new RefundError(404, "Order not found.");
    if (order.status !== "PAID" || order.paymentProvider !== "PAYSTACK" || !order.paystackRef) {
      throw new RefundError(
        409,
        "Only paid Paystack orders can be refunded."
      );
    }

    let resolvedTicketId: string | null = input.ticketId ?? null;
    if (!resolvedTicketId && input.ticketCode) {
      const ticket = await tx.ticket.findFirst({
        where: { code: input.ticketCode.trim().toUpperCase(), orderId: order.id },
        select: { id: true },
      });
      if (!ticket) {
        throw new RefundError(
          400,
          "That ticket code is not part of this order."
        );
      }
      resolvedTicketId = ticket.id;
    } else if (resolvedTicketId) {
      const ticket = await tx.ticket.findFirst({
        where: { id: resolvedTicketId, orderId: order.id },
      });
      if (!ticket) {
        throw new RefundError(400, "Ticket does not belong to this order.");
      }
    }

    const remaining = refundableRemaining(
      order.amount.toNumber(),
      order.refunds.map((r) => ({
        amount: r.amount.toNumber(),
        status: r.status,
      }))
    );
    if (amount > remaining) {
      throw new RefundError(
        409,
        `Refund exceeds the refundable balance (${order.currency} ${remaining}).`
      );
    }

    const refund = await tx.refund.create({
      data: {
        orderId: order.id,
        ticketId: resolvedTicketId,
        amount,
        currency: order.currency,
        reason,
        requesterCrmUserId: input.requesterCrmUserId,
        paystackTransactionRef: order.paystackRef,
      },
    });
    await tx.refundEvent.create({
      data: {
        refundId: refund.id,
        type: "REQUESTED",
        status: "REQUESTED",
        actorCrmUserId: input.requesterCrmUserId,
        message: reason,
      },
    });
    await recordAudit(tx, {
      actorCrmUserId: input.requesterCrmUserId,
      action: "refund.request",
      targetType: "refund",
      targetId: refund.id,
      after: { orderId: order.id, amount, ticketId: resolvedTicketId },
      reason,
    });
    return refund;
  });
}

/**
 * Approve a refund request. Self-approval is blocked here (server-side), then
 * the refund is submitted to Paystack using the server-stored original
 * transaction reference — never a client-supplied one.
 */
export async function approveRefund(input: {
  refundId: string;
  approverCrmUserId: string;
}) {
  const refund = await prisma.refund.findUnique({
    where: { id: input.refundId },
  });
  if (!refund) throw new RefundError(404, "Refund not found.");
  if (refund.status !== "REQUESTED") {
    throw new RefundError(409, `Refund is ${refund.status}, not REQUESTED.`);
  }
  if (refund.requesterCrmUserId === input.approverCrmUserId) {
    throw new RefundError(403, "You cannot approve your own refund request.");
  }
  if (!isPaystackConfigured()) {
    throw new RefundError(
      503,
      "PAYSTACK_SECRET_KEY is not configured on the CRM server; the refund cannot be submitted."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: "APPROVED",
        approverCrmUserId: input.approverCrmUserId,
        approvedAt: new Date(),
      },
    });
    await tx.refundEvent.create({
      data: {
        refundId: refund.id,
        type: "APPROVED",
        status: "APPROVED",
        actorCrmUserId: input.approverCrmUserId,
      },
    });
    await recordAudit(tx, {
      actorCrmUserId: input.approverCrmUserId,
      action: "refund.approve",
      targetType: "refund",
      targetId: refund.id,
      before: { status: "REQUESTED" },
      after: { status: "APPROVED" },
    });
  });

  return submitRefund(refund.id, input.approverCrmUserId);
}

export async function rejectRefund(input: {
  refundId: string;
  approverCrmUserId: string;
  reason: string;
}) {
  const reason = (input.reason ?? "").trim();
  if (!reason) throw new RefundError(400, "A rejection reason is required.");
  const refund = await prisma.refund.findUnique({
    where: { id: input.refundId },
  });
  if (!refund) throw new RefundError(404, "Refund not found.");
  if (refund.status !== "REQUESTED") {
    throw new RefundError(409, `Refund is ${refund.status}, not REQUESTED.`);
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: "REJECTED",
        approverCrmUserId: input.approverCrmUserId,
        failureReason: reason,
      },
    });
    await tx.refundEvent.create({
      data: {
        refundId: refund.id,
        type: "REJECTED",
        status: "REJECTED",
        actorCrmUserId: input.approverCrmUserId,
        message: reason,
      },
    });
    await recordAudit(tx, {
      actorCrmUserId: input.approverCrmUserId,
      action: "refund.reject",
      targetType: "refund",
      targetId: refund.id,
      reason,
    });
    return updated;
  });
}

/** Submit an APPROVED refund to Paystack and store the provider response. */
export async function submitRefund(refundId: string, actorCrmUserId: string) {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: { order: true },
  });
  if (!refund) throw new RefundError(404, "Refund not found.");
  if (refund.status !== "APPROVED") {
    throw new RefundError(409, `Refund is ${refund.status}, not APPROVED.`);
  }
  const transactionRef = refund.paystackTransactionRef ?? refund.order.paystackRef;
  if (!transactionRef) {
    throw new RefundError(
      409,
      "The original Paystack transaction reference is unavailable."
    );
  }

  const refundAmount = refund.amount.toNumber();
  const isFull = refundAmount >= round2(refund.order.amount.toNumber());

  let provider: PaystackRefund;
  try {
    provider = await initializeRefund({
      transaction: transactionRef,
      amount: isFull ? undefined : refundAmount,
      merchantNote: `refund:${refund.id}`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Refund submission failed";
    await prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: refund.id },
        data: { status: "NEEDS_ATTENTION", failureReason: message },
      });
      await tx.refundEvent.create({
        data: {
          refundId: refund.id,
          type: "NEEDS_ATTENTION",
          status: "NEEDS_ATTENTION",
          actorCrmUserId,
          message,
        },
      });
      await recordAudit(tx, {
        actorCrmUserId,
        action: "refund.submit_failed",
        targetType: "refund",
        targetId: refund.id,
        reason: message,
      });
    });
    throw new RefundError(502, message);
  }

  await applyProviderRefund(refund.id, provider, actorCrmUserId, true);
  return prisma.refund.findUnique({ where: { id: refund.id } });
}

/** Re-poll Paystack for the latest refund state and reconcile it. */
export async function reconcileRefund(refundId: string, actorCrmUserId?: string) {
  const refund = await prisma.refund.findUnique({ where: { id: refundId } });
  if (!refund) throw new RefundError(404, "Refund not found.");
  if (!refund.paystackRefundId) {
    throw new RefundError(
      409,
      "This refund has no Paystack refund id yet — it has not been submitted."
    );
  }
  const provider = await fetchRefund(refund.paystackRefundId);
  await applyProviderRefund(refund.id, provider, actorCrmUserId ?? null, false);
  return prisma.refund.findUnique({ where: { id: refund.id } });
}

/**
 * Persist a provider refund response, append an immutable event, and invalidate
 * tickets only once the provider confirms the refund (PROCESSED). Intermediate
 * (SUBMITTED/PROCESSING) states leave tickets valid and visible as pending.
 */
async function applyProviderRefund(
  refundId: string,
  provider: PaystackRefund,
  actorCrmUserId: string | null,
  isFirstSubmission: boolean
) {
  const mapped = mapRefundStatus(provider.status);

  await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findUnique({
      where: { id: refundId },
      include: { order: true },
    });
    if (!refund) throw new RefundError(404, "Refund not found.");

    const now = new Date();
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: mapped,
        paystackRefundId: String(provider.id),
        providerStatus: provider.status,
        submittedAt: refund.submittedAt ?? now,
        settledAt: mapped === "PROCESSED" ? now : refund.settledAt,
        failureReason:
          mapped === "FAILED" ? provider.status : refund.failureReason,
      },
    });
    await tx.refundEvent.create({
      data: {
        refundId: refund.id,
        type: isFirstSubmission ? "SUBMITTED" : "PROVIDER_UPDATE",
        status: mapped,
        providerStatus: provider.status,
        actorCrmUserId,
        data: provider as unknown as Prisma.InputJsonValue,
      },
    });

    if (mapped === "PROCESSED") {
      await invalidateRefundedTickets(tx, refund.orderId, refund.ticketId);
      const allRefunds = await tx.refund.findMany({
        where: { orderId: refund.orderId },
      });
      const processed = allRefunds
        .filter((r) => r.status === "PROCESSED")
        .reduce((s, r) => s + r.amount.toNumber(), 0);
      const orderTotal = refund.order.amount.toNumber();
      const fully = processed >= round2(orderTotal);
      await tx.order.update({
        where: { id: refund.orderId },
        data: {
          paymentStatus: fully ? "REFUNDED" : "PARTIALLY_REFUNDED",
          ...(fully ? { status: "REFUNDED" as const } : {}),
        },
      });
    }

    await recordAudit(tx, {
      actorCrmUserId,
      action: `refund.provider_${mapped.toLowerCase()}`,
      targetType: "refund",
      targetId: refund.id,
      after: {
        providerStatus: provider.status,
        paystackRefundId: String(provider.id),
      },
    });
  });
}

/** Void QR codes for refunded tickets. Never recycles a code. */
async function invalidateRefundedTickets(
  tx: Prisma.TransactionClient,
  orderId: string,
  ticketId: string | null
) {
  if (ticketId) {
    await tx.ticket.updateMany({
      where: { id: ticketId, status: { not: "REFUNDED" } },
      data: { status: "REFUNDED" },
    });
    return;
  }
  await tx.ticket.updateMany({
    where: { orderId, status: { not: "REFUNDED" } },
    data: { status: "REFUNDED" },
  });
}

export async function listRefunds(filters: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const limit =
    filters.limit && filters.limit > 0 && filters.limit <= 200
      ? filters.limit
      : 25;
  const where: Prisma.RefundWhereInput = {};
  if (filters.status) {
    where.status = filters.status as RefundStatus;
  }
  const [rows, total] = await Promise.all([
    prisma.refund.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        order: {
          select: {
            id: true,
            amount: true,
            currency: true,
            guestName: true,
            guestEmail: true,
            paystackRef: true,
            user: { select: { email: true, username: true } },
          },
        },
        requester: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
        ticket: { select: { id: true, code: true } },
      },
    }),
    prisma.refund.count({ where }),
  ]);
  return { rows, total, page, limit };
}
