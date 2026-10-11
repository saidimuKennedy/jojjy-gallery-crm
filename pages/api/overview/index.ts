import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { getUserPermissionKeys } from "@/lib/permissions";
import { promoteEventStatus } from "@/lib/events";

/**
 * GET /api/overview — single aggregation endpoint for the Overview command
 * centre. Returns ONLY sections the caller is permitted to see; permitted
 * but empty sections are explicit nulls/empty arrays (never fake zeros for
 * failed queries — a failure here is a 500, not zeroed sections).
 *
 * Time semantics: there is no canonical paidAt on Order/Payment in this
 * schema, so every commerce fact is ALL-TIME. Period metrics must not be
 * derived from createdAt/updatedAt.
 * Currency rule: catalogue money (Order.amount/currency, ticket unitPrice)
 * and Paystack charge money (paystackChargeAmount/paystackChargeCurrency)
 * are never summed together and never converted. Collections are grouped
 * by charge currency; event gross is grouped by catalogue currency.
 */

function dec(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function itemLabel(item: {
  itemType: string;
  artwork?: { title: string } | null;
  ticketType?: { name: string; event: { title: string } } | null;
  productVariant?: { sku: string; product: { name: string } } | null;
  release?: { title: string } | null;
  membershipPlan?: { name: string } | null;
}): string {
  if (item.itemType === "ARTWORK" && item.artwork) return item.artwork.title;
  if (item.itemType === "TICKET" && item.ticketType)
    return `${item.ticketType.name} — ${item.ticketType.event.title}`;
  if (item.itemType === "PRODUCT" && item.productVariant)
    return `${item.productVariant.product.name} (${item.productVariant.sku})`;
  if (item.itemType === "RELEASE" && item.release) return item.release.title;
  if (item.itemType === "MEMBERSHIP_PASS" && item.membershipPlan)
    return item.membershipPlan.name;
  return item.itemType;
}

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

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res
      .status(401)
      .json({ success: false, message: "Authentication required" });
  }
  const permissions = await getUserPermissionKeys(session.user.id);
  const can = (key: string) => permissions.has(key);

  const canOrders = can("orders:read");
  const canEvents = can("events:read");
  const canArtworks = can("artworks:read");
  const canMerch = can("merch:read");
  const canMusic = can("music:read");

  try {
    const data: Record<string, unknown> = {};

    if (canOrders) {
      const [ordersToFulfil, refundsAwaiting, paymentsAttention] =
        await Promise.all([
          // Physical fulfilment predicate mirrors the orders page/API:
          // PAID + not yet fulfilled + a delivery method set. Tickets and
          // digital access never use fulfilledAt (schema comment) and have
          // no deliveryMethod, so they can never match.
          prisma.order.count({
            where: {
              status: "PAID",
              fulfilledAt: null,
              deliveryMethod: { not: null },
            },
          }),
          // Refund states needing a human: awaiting approve/reject, or a
          // failed submission needing review. Mirrors lib/refunds lifecycle.
          prisma.refund.count({
            where: { status: { in: ["REQUESTED", "NEEDS_ATTENTION"] } },
          }),
          prisma.order.count({
            where: { paymentStatus: "NEEDS_ATTENTION" },
          }),
        ]);
      data.attention = { ordersToFulfil, refundsAwaiting, paymentsAttention };

      const [collections, paidOrders, ticketsSold, purchaserGroups] =
        await Promise.all([
          // Successful Paystack collections grouped by CHARGE currency.
          // Paid signal is Order.status = PAID (written by checkout);
          // charge money is never mixed with catalogue money.
          prisma.order.groupBy({
            by: ["paystackChargeCurrency"],
            where: {
              status: "PAID",
              paystackChargeAmount: { not: null },
            },
            _sum: { paystackChargeAmount: true },
          }),
          prisma.order.count({ where: { status: "PAID" } }),
          prisma.ticketType.aggregate({ _sum: { quantitySold: true } }),
          // Registered purchasers: distinct non-null userIds on PAID orders.
          prisma.order.groupBy({
            by: ["userId"],
            where: { status: "PAID", userId: { not: null } },
          }),
        ]);
      data.commerce = {
        collections: collections.map((c) => ({
          currency: c.paystackChargeCurrency ?? "KES",
          amount: dec(c._sum.paystackChargeAmount) ?? 0,
        })),
        paidOrders,
        ticketsSold: ticketsSold._sum.quantitySold ?? 0,
        registeredPurchasers: purchaserGroups.length,
      };
    }

    if (canEvents) {
      // Upcoming reuses the event lifecycle: PUBLISHED (after lazy
      // promotion) with startsAt in the future and not ended. Nearest first.
      const now = new Date();
      const candidates = await prisma.event.findMany({
        where: {
          status: { in: ["DRAFT", "PUBLISHED"] },
          startsAt: { gte: now },
        },
        orderBy: { startsAt: "asc" },
        take: 3,
        select: {
          id: true,
          title: true,
          slug: true,
          venue: true,
          imageUrl: true,
          startsAt: true,
          endsAt: true,
          status: true,
          publishAt: true,
          ticketMode: true,
          ticketTypes: {
            select: { id: true, quantity: true, quantitySold: true },
          },
        },
      });
      let next: (typeof candidates)[number] | null = null;
      for (const candidate of candidates) {
        const status = await promoteEventStatus(candidate, now);
        if (status !== "PUBLISHED") continue;
        if (candidate.endsAt && candidate.endsAt.getTime() <= now.getTime())
          continue;
        next = { ...candidate, status };
        break;
      }

      if (next) {
        const capacity = next.ticketTypes.reduce((s, t) => s + t.quantity, 0);
        const sold = next.ticketTypes.reduce((s, t) => s + t.quantitySold, 0);
        // Remaining convention mirrors the sales endpoint:
        // per-type max(0, quantity - quantitySold), summed.
        const remaining = next.ticketTypes.reduce(
          (s, t) => s + Math.max(0, t.quantity - t.quantitySold),
          0
        );
        let grossByCurrency: { currency: string; amount: number }[] = [];
        let purchaserCount: number | null = null;
        const typeIds = next.ticketTypes.map((t) => t.id);
        if (canOrders && typeIds.length > 0) {
          // Same derivation as the sales endpoint: paid OrderItems for the
          // event's ticket types; gross grouped by catalogue currency.
          const paidItems = await prisma.orderItem.findMany({
            where: { ticketTypeId: { in: typeIds }, order: { status: "PAID" } },
            select: {
              quantity: true,
              unitPrice: true,
              order: { select: { id: true, currency: true } },
            },
          });
          const gross = new Map<string, number>();
          const orders = new Set<string>();
          for (const item of paidItems) {
            orders.add(item.order.id);
            const line = item.quantity * Number(item.unitPrice);
            gross.set(
              item.order.currency,
              Math.round(((gross.get(item.order.currency) ?? 0) + line) * 100) /
                100
            );
          }
          grossByCurrency = [...gross.entries()].map(([currency, amount]) => ({
            currency,
            amount,
          }));
          purchaserCount = orders.size;
        }
        data.upcomingEvent = {
          id: next.id,
          title: next.title,
          slug: next.slug,
          venue: next.venue,
          imageUrl: next.imageUrl,
          startsAt: next.startsAt.toISOString(),
          status: next.status,
          ticketMode: next.ticketMode,
          capacity,
          sold,
          remaining,
          grossByCurrency,
          purchaserCount,
        };
      } else {
        data.upcomingEvent = null;
      }
    }

    // Recent work: newest content with usable imagery, merged across the
    // domains the caller may read. Ordering rule per source matches each
    // list page (createdAt; releases use updatedAt like the music list).
    const workQueries: Promise<
      {
        kind: string;
        id: number | string;
        title: string;
        imageUrl: string | null;
        timestamp: string;
        statusLabel: string | null;
        href: string;
      }[]
    >[] = [];
    if (canArtworks) {
      workQueries.push(
        prisma.artwork
          .findMany({
            orderBy: { createdAt: "desc" },
            take: 6,
            select: { id: true, title: true, imageUrl: true, createdAt: true, status: true },
          })
          .then((rows) =>
            rows.map((r) => ({
              kind: "artwork",
              id: r.id,
              title: r.title,
              imageUrl: r.imageUrl ?? null,
              timestamp: r.createdAt.toISOString(),
              statusLabel: r.status,
              href: `/dashboard/artworks?resume=artwork:${r.id}`,
            }))
          )
      );
      workQueries.push(
        prisma.mediaBlogEntry
          .findMany({
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
              id: true,
              title: true,
              thumbnailUrl: true,
              createdAt: true,
              publishedAt: true,
            },
          })
          .then((rows) =>
            rows.map((r) => ({
              kind: "media",
              id: r.id,
              title: r.title,
              imageUrl: r.thumbnailUrl ?? null,
              timestamp: r.createdAt.toISOString(),
              statusLabel: r.publishedAt ? "Published" : "Draft",
              href: `/dashboard/media-blog?resume=mediablog:${r.id}`,
            }))
          )
      );
    }
    if (canMerch) {
      workQueries.push(
        prisma.product
          .findMany({
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
              id: true,
              name: true,
              imageUrl: true,
              createdAt: true,
              isAvailable: true,
            },
          })
          .then((rows) =>
            rows.map((r) => ({
              kind: "product",
              id: r.id,
              title: r.name,
              imageUrl: r.imageUrl ?? null,
              timestamp: r.createdAt.toISOString(),
              statusLabel: r.isAvailable ? "Available" : "Hidden",
              href: `/dashboard/merch?resume=product:${r.id}`,
            }))
          )
      );
    }
    if (canMusic) {
      workQueries.push(
        prisma.release
          .findMany({
            orderBy: { updatedAt: "desc" },
            take: 6,
            select: {
              id: true,
              title: true,
              coverImage: true,
              updatedAt: true,
              publishStatus: true,
            },
          })
          .then((rows) =>
            rows.map((r) => ({
              kind: "release",
              id: r.id,
              title: r.title,
              imageUrl: r.coverImage ?? null,
              timestamp: r.updatedAt.toISOString(),
              statusLabel: r.publishStatus,
              href: `/dashboard/music?resume=release:${r.id}`,
            }))
          )
      );
    }
    if (workQueries.length > 0) {
      const groups = await Promise.all(workQueries);
      data.recentWork = groups
        .flat()
        .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
        .slice(0, 6);
    }

    if (canOrders) {
      const orders = await prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          source: true,
          amount: true,
          currency: true,
          paystackChargeAmount: true,
          paystackChargeCurrency: true,
          customerName: true,
          guestName: true,
          guestEmail: true,
          fulfilledAt: true,
          deliveryMethod: true,
          createdAt: true,
          user: { select: { email: true, username: true } },
          items: {
            select: {
              itemType: true,
              quantity: true,
              unitPrice: true,
              artwork: { select: { title: true } },
              ticketType: {
                select: { name: true, event: { select: { title: true } } },
              },
              productVariant: {
                select: { sku: true, product: { select: { name: true } } },
              },
              release: { select: { title: true } },
              membershipPlan: { select: { name: true } },
            },
          },
        },
      });
      data.recentOrders = orders.map((o) => {
        const labels = o.items.map(itemLabel);
        const purchase =
          labels.length <= 1
            ? (labels[0] ?? o.status)
            : `${labels[0]} (+${labels.length - 1} more)`;
        return {
          id: o.id,
          customer:
            o.customerName ||
            o.guestName ||
            o.user?.username ||
            o.user?.email ||
            "Guest buyer",
          purchase,
          amount: Number(o.amount),
          currency: o.currency,
          chargeAmount: dec(o.paystackChargeAmount),
          chargeCurrency: o.paystackChargeCurrency,
          status: o.status,
          paymentStatus: o.paymentStatus,
          source: o.source,
          fulfilledAt: o.fulfilledAt ? o.fulfilledAt.toISOString() : null,
          deliveryMethod: o.deliveryMethod,
          itemTypes: [...new Set(o.items.map((i) => i.itemType))],
          // Date shown is placement (createdAt). There is no paidAt; never
          // label this a payment date.
          placedAt: o.createdAt.toISOString(),
        };
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error building overview:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}

