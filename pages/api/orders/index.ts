import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

function serializeOrder(order: {
  id: string;
  status: string;
  amount: { toNumber(): number };
  currency: string;
  paystackChargeAmount: { toNumber(): number } | null;
  paystackChargeCurrency: string | null;
  customerName: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  source: string;
  paymentStatus: string;
  phoneNumber: string | null;
  deliveryNotes: string | null;
  fulfilledAt: Date | null;
  deliveryMethod: string | null;
  deliveryAddress: string | null;
  packaging: string | null;
  createdAt: Date;
  user: { email: string; username: string } | null;
  paystackRef: string | null;
  items: {
    itemType: string;
    quantity: number;
    unitPrice: { toNumber(): number };
    productVariantId: number | null;
    ticketTypeId: number | null;
    artworkId: number | null;
    releaseId: number | null;
    membershipPlanId: number | null;
    artwork: { title: string } | null;
    ticketType: { name: string; event: { id: number; title: string } } | null;
    productVariant: { sku: string; product: { name: string } } | null;
    release: { title: string } | null;
    membershipPlan: { name: string } | null;
  }[];
  tickets: { code: string; ticketType: { name: string } }[];
}) {
  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    source: order.source,
    amount: order.amount.toNumber(),
    currency: order.currency,
    chargeAmount: order.paystackChargeAmount
      ? order.paystackChargeAmount.toNumber()
      : null,
    chargeCurrency: order.paystackChargeCurrency,
    customerName: order.customerName ?? order.guestName,
    phoneNumber: order.phoneNumber ?? order.guestPhone,
    deliveryNotes: order.deliveryNotes,
    fulfilledAt: order.fulfilledAt ? order.fulfilledAt.toISOString() : null,
    deliveryMethod: order.deliveryMethod,
    deliveryAddress: order.deliveryAddress,
    packaging: order.packaging,
    createdAt: order.createdAt.toISOString(),
    customerEmail: order.user?.email ?? order.guestEmail ?? null,
    customerUsername: order.user?.username ?? null,
    paystackRef: order.paystackRef,
    items: order.items.map((item) => {
      let label = item.itemType;
      if (item.artwork) label = item.artwork.title;
      if (item.ticketType)
        label = `${item.ticketType.name} — ${item.ticketType.event.title}`;
      if (item.productVariant)
        label = `${item.productVariant.product.name} (${item.productVariant.sku})`;
      if (item.release) label = item.release.title;
      if (item.membershipPlan) label = item.membershipPlan.name;
      return {
        itemType: item.itemType,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        productVariantId: item.productVariantId,
        ticketTypeId: item.ticketTypeId,
        artworkId: item.artworkId,
        releaseId: item.releaseId,
        membershipPlanId: item.membershipPlanId,
        eventId: item.ticketType ? item.ticketType.event.id : null,
        label,
      };
    }),
    tickets: order.tickets.map((t) => ({
      code: t.code,
      ticketType: t.ticketType.name,
    })),
  };
}

const include = {
  user: { select: { email: true, username: true } },
  items: {
    include: {
      artwork: { select: { title: true } },
      ticketType: {
        select: { name: true, event: { select: { id: true, title: true } } },
      },
      productVariant: {
        select: { sku: true, product: { select: { name: true } } },
      },
      release: { select: { title: true } },
      membershipPlan: { select: { name: true } },
    },
  },
  tickets: {
    include: { ticketType: { select: { name: true } } },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    if (!(await requirePermission(req, res, "orders:read"))) return;
    try {
      const { status, q, page = "1", limit = "25" } = req.query;
      const where: Record<string, unknown> = {};
      if (typeof status === "string" && status) {
        where.status = status;
      }
      if (typeof q === "string" && q.trim()) {
        where.OR = [
          { customerName: { contains: q.trim(), mode: "insensitive" } },
          { guestName: { contains: q.trim(), mode: "insensitive" } },
          { guestEmail: { contains: q.trim(), mode: "insensitive" } },
          { user: { email: { contains: q.trim(), mode: "insensitive" } } },
          { paystackRef: { contains: q.trim(), mode: "insensitive" } },
        ];
      }
      let pageNum = parseInt(Array.isArray(page) ? page[0] : page, 10);
      if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
      let limitNum = parseInt(
        Array.isArray(limit) ? limit[0] : limit,
        10
      );
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 200) limitNum = 25;
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
          include,
        }),
        prisma.order.count({ where }),
      ]);
      return res.status(200).json({
        success: true,
        data: orders.map(serializeOrder),
        total,
        page: pageNum,
        limit: limitNum,
      });
    } catch (error) {
      console.error("Error listing orders:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  res.setHeader("Allow", ["GET"]);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} Not Allowed`,
  });
}
