import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

/**
 * Factual event sales intelligence, derived only from persisted rows.
 * Definitions (see commerce review):
 * - TICKET SOLD (counter): TicketType.quantitySold
 * - TICKET SOLD (rows): COUNT(Ticket WHERE ticketTypeId)
 * - TICKET SOLD (orders): SUM(PAID OrderItem.quantity)
 *   All three are returned so discrepancies stay visible, never hidden.
 * - Gross catalogue: SUM(PAID item qty × unitPrice), labelled per order
 *   currency (ticket catalogue is USD). No silent FX.
 * - Purchasers: distinct PAID orders containing this event's tickets.
 *   Purchasers are NOT attendees (no check-in workflow exists).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  // Purchaser rows carry customer PII: require both event and order visibility.
  if (!(await requirePermission(req, res, "events:read"))) return;
  if (!(await requirePermission(req, res, "orders:read"))) return;

  const { id, purchaserPage = "1", purchaserLimit = "50" } = req.query;
  const eventId = typeof id === "string" ? parseInt(id, 10) : NaN;
  if (isNaN(eventId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid event id" });
  }
  let pp = parseInt(
    Array.isArray(purchaserPage) ? purchaserPage[0] : purchaserPage,
    10
  );
  if (isNaN(pp) || pp < 1) pp = 1;
  let pl = parseInt(
    Array.isArray(purchaserLimit) ? purchaserLimit[0] : purchaserLimit,
    10
  );
  if (isNaN(pl) || pl < 1 || pl > 200) pl = 50;

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, slug: true, status: true, startsAt: true },
    });
    if (!event) {
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    }

    const types = await prisma.ticketType.findMany({
      where: { eventId },
      orderBy: { price: "asc" },
    });
    const typeIds = types.map((t) => t.id);

    const [ticketRowCount, paidItems] = await Promise.all([
      typeIds.length
        ? prisma.ticket.count({ where: { ticketTypeId: { in: typeIds } } })
        : 0,
      typeIds.length
        ? prisma.orderItem.findMany({
            where: {
              ticketTypeId: { in: typeIds },
              order: { status: "PAID" },
            },
            include: {
              order: {
                select: {
                  id: true,
                  status: true,
                  paymentStatus: true,
                  source: true,
                  amount: true,
                  currency: true,
                  paystackRef: true,
                  paystackChargeAmount: true,
                  paystackChargeCurrency: true,
                  customerName: true,
                  guestName: true,
                  guestEmail: true,
                  guestPhone: true,
                  phoneNumber: true,
                  createdAt: true,
                  user: { select: { email: true, username: true } },
                },
              },
            },
          })
        : [],
    ]);

    const byType = types.map((t) => {
      const items = paidItems.filter((i) => i.ticketTypeId === t.id);
      const paidQty = items.reduce((s, i) => s + i.quantity, 0);
      const grossCatalogue =
        Math.round(
          items.reduce((s, i) => s + i.quantity * i.unitPrice.toNumber(), 0) *
            100
        ) / 100;
      return {
        id: t.id,
        name: t.name,
        price: t.price.toNumber(),
        quantity: t.quantity,
        quantitySold: t.quantitySold,
        remaining: Math.max(0, t.quantity - t.quantitySold),
        paidItemQuantity: paidQty,
        grossCatalogue,
        grossCurrency: "USD",
        salesStart: t.salesStart ? t.salesStart.toISOString() : null,
        salesEnd: t.salesEnd ? t.salesEnd.toISOString() : null,
      };
    });

    const paidQtyTotal = byType.reduce((s, t) => s + t.paidItemQuantity, 0);
    const grossCatalogueTotal =
      Math.round(byType.reduce((s, t) => s + t.grossCatalogue, 0) * 100) / 100;

    // Purchasers: distinct PAID orders touching this event, newest first.
    const seen = new Map<string, (typeof paidItems)[number]>();
    for (const item of paidItems) {
      if (!seen.has(item.order.id)) seen.set(item.order.id, item);
    }
    const purchaserOrders = [...seen.values()].sort(
      (a, b) => b.order.createdAt.getTime() - a.order.createdAt.getTime()
    );
    const totalPurchasers = purchaserOrders.length;
    const page = purchaserOrders.slice((pp - 1) * pl, pp * pl).map((item) => {
      const o = item.order;
      const lines = paidItems
        .filter((i) => i.order.id === o.id)
        .map((i) => {
          const tt = types.find((t) => t.id === i.ticketTypeId);
          return {
            ticketType: tt ? tt.name : `type ${i.ticketTypeId}`,
            quantity: i.quantity,
            unitPrice: i.unitPrice.toNumber(),
          };
        });
      return {
        orderId: o.id,
        customer:
          o.customerName ||
          o.guestName ||
          o.user?.username ||
          o.user?.email ||
          "Guest buyer",
        email: o.user?.email ?? o.guestEmail ?? null,
        phone: o.phoneNumber ?? o.guestPhone,
        paymentStatus: o.paymentStatus,
        source: o.source,
        lines,
        catalogueTotal: o.amount.toNumber(),
        catalogueCurrency: o.currency,
        chargeAmount: o.paystackChargeAmount
          ? o.paystackChargeAmount.toNumber()
          : null,
        chargeCurrency: o.paystackChargeCurrency,
        status: o.status,
        paystackRef: o.paystackRef,
        createdAt: o.createdAt.toISOString(),
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        event: {
          ...event,
          startsAt: event.startsAt.toISOString(),
        },
        reconciliation: {
          counterSold: types.reduce((s, t) => s + t.quantitySold, 0),
          ticketRows: ticketRowCount,
          paidItemQuantity: paidQtyTotal,
        },
        totals: {
          capacity: types.reduce((s, t) => s + t.quantity, 0),
          sold: types.reduce((s, t) => s + t.quantitySold, 0),
          remaining: types.reduce(
            (s, t) => s + Math.max(0, t.quantity - t.quantitySold),
            0
          ),
          grossCatalogue: grossCatalogueTotal,
          grossCurrency: "USD",
          purchaserOrders: totalPurchasers,
        },
        types: byType,
        purchasers: page,
        purchaserPage: pp,
        purchaserLimit: pl,
        purchaserTotal: totalPurchasers,
      },
    });
  } catch (error) {
    console.error("Error loading event sales:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}
