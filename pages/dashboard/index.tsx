import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Package,
  ShoppingBag,
  Ticket,
  Undo2,
  Users,
  Wallet,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { listDrafts, type DraftSummary } from "@/lib/form-draft";
import { orderOperationalStatus } from "@/lib/order-status";
import {
  Card,
  Chip,
  ErrorState,
  LinkButton,
  LoadingState,
  PageHeader,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";

type QuickAction = {
  label: string;
  href: string;
  permission: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { label: "+ Add artwork", href: "/dashboard/artworks?resume=artwork:new", permission: "artworks:write" },
  { label: "+ Add event", href: "/dashboard/events?resume=event:new", permission: "events:write" },
  { label: "+ Add merch", href: "/dashboard/merch?resume=product:new", permission: "merch:write" },
  { label: "+ Add release", href: "/dashboard/music?resume=release:new", permission: "music:write" },
];

const DRAFT_ROUTES: Record<string, string> = {
  artwork: "/dashboard/artworks",
  series: "/dashboard/series",
  mediablog: "/dashboard/media-blog",
  event: "/dashboard/events",
  ticket: "/dashboard/tickets",
  product: "/dashboard/merch",
  release: "/dashboard/music",
  announcement: "/dashboard/announcements",
};

const DRAFT_DOMAIN_LABELS: Record<string, string> = {
  artwork: "Artwork",
  series: "Series",
  mediablog: "Media entry",
  event: "Event",
  ticket: "Ticket type",
  product: "Product",
  release: "Release",
  announcement: "Announcement",
};

const WORK_KIND_LABELS: Record<string, string> = {
  artwork: "Artwork",
  product: "Product",
  media: "Media",
  release: "Release",
};

function draftHref(d: DraftSummary): string {
  const route = DRAFT_ROUTES[d.domain];
  if (!route) return "/dashboard";
  // Ticket drafts carry their event context differently: create drafts are
  // keyed by event (preselect it); edit drafts open from the tickets page.
  if (d.domain === "ticket") {
    if (d.record.startsWith("new:")) {
      const eventId = d.record.slice("new:".length);
      return eventId ? `${route}?event=${encodeURIComponent(eventId)}` : route;
    }
    return route;
  }
  return `${route}?resume=${encodeURIComponent(`${d.domain}:${d.record}`)}`;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms) || ms < 0) return "recently";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(currency: string, amount: number): string {
  const formatted = amount.toLocaleString("en-US", {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    minimumFractionDigits: 0,
  });
  return `${currency} ${formatted}`;
}

type OverviewPayload = {
  attention?: {
    ordersToFulfil: number;
    refundsAwaiting: number;
    paymentsAttention: number;
  };
  commerce?: {
    collections: { currency: string; amount: number }[];
    paidOrders: number;
    ticketsSold: number;
    registeredPurchasers: number;
  };
  upcomingEvent?: {
    id: number;
    title: string;
    slug: string;
    venue: string | null;
    imageUrl: string | null;
    startsAt: string;
    status: string;
    ticketMode: string;
    capacity: number;
    sold: number;
    remaining: number;
    grossByCurrency: { currency: string; amount: number }[];
    purchaserCount: number | null;
  } | null;
  recentWork?: {
    kind: string;
    id: number | string;
    title: string;
    imageUrl: string | null;
    timestamp: string;
    statusLabel: string | null;
    href: string;
  }[];
  recentOrders?: {
    id: string;
    customer: string;
    purchase: string;
    amount: number;
    currency: string;
    chargeAmount: number | null;
    chargeCurrency: string | null;
    status: string;
    paymentStatus: string;
    source: string;
    fulfilledAt: string | null;
    deliveryMethod: string | null;
    itemTypes: string[];
    placedAt: string;
  }[];
};

const overviewFetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to load overview");
  return json.data as OverviewPayload;
};

function SectionTitle({
  title,
  hint,
  linkHref,
  linkLabel,
}: {
  title: string;
  hint?: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold text-ink-800">
        {title}
        {hint && (
          <span className="ml-2 text-xs font-normal text-ink-400">{hint}</span>
        )}
      </h2>
      {linkHref && (
        <Link
          href={linkHref}
          className="shrink-0 text-xs font-medium text-accent-700 underline-offset-2 hover:underline"
        >
          {linkLabel ?? "View all →"}
        </Link>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const can = (key: string) => permissions.includes(key);

  const {
    data: overview,
    error: overviewError,
    isLoading: overviewLoading,
    mutate: retryOverview,
  } = useSWR("/api/overview", overviewFetcher);

  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  useEffect(() => {
    setDrafts(listDrafts());
  }, []);

  const railRef = useRef<HTMLDivElement>(null);
  const scrollRail = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const actions = QUICK_ACTIONS.filter((a) => can(a.permission));
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const attention = overview?.attention;
  const attentionCards = attention
    ? [
        attention.ordersToFulfil > 0 && {
          key: "fulfil",
          count: attention.ordersToFulfil,
          title: "Orders to fulfil",
          explainer: "Paid physical orders awaiting fulfilment.",
          href: "/dashboard/orders",
          linkLabel: "View orders →",
          icon: <Package className="h-5 w-5" aria-hidden="true" />,
          iconClass: "bg-accent-50 text-accent-700",
        },
        attention.refundsAwaiting > 0 && {
          key: "refunds",
          count: attention.refundsAwaiting,
          title: "Refunds awaiting action",
          explainer: "Requested refunds needing review.",
          href: "/dashboard/refunds",
          linkLabel: "Review refunds →",
          icon: <Undo2 className="h-5 w-5" aria-hidden="true" />,
          iconClass: "bg-amber-50 text-amber-700",
        },
        attention.paymentsAttention > 0 && {
          key: "payments",
          count: attention.paymentsAttention,
          title: "Payments need attention",
          explainer: "Orders flagged for payment review.",
          href: "/dashboard/orders",
          linkLabel: "Review orders →",
          icon: <AlertCircle className="h-5 w-5" aria-hidden="true" />,
          iconClass: "bg-red-50 text-red-700",
        },
      ].filter(Boolean)
    : [];

  const event = overview?.upcomingEvent ?? undefined;
  const eventProgress =
    event && event.capacity > 0
      ? Math.min(100, Math.round((event.sold / event.capacity) * 100))
      : 0;

  return (
    <DashboardLayout>
      <Head>
        <title>Overview — Jojjy Gallery CRM</title>
      </Head>

      <PageHeader
        title="Overview"
        subtitle="Your studio, commerce and events at a glance."
        actions={<span className="text-sm text-ink-500">{today}</span>}
      />

      {actions.length > 0 && (
        <section aria-label="Quick actions">
          <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500">
            Quick actions
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((a) => (
              <LinkButton
                key={a.href}
                href={a.href}
                className="px-4 py-2 text-sm"
              >
                {a.label}
              </LinkButton>
            ))}
          </div>
        </section>
      )}

      {overviewLoading ? (
        <div className="mt-8">
          <LoadingState label="Loading overview…" />
        </div>
      ) : overviewError || !overview ? (
        <div className="mt-8">
          <ErrorState
            message={overviewError?.message || "Could not load overview."}
            onRetry={() => retryOverview()}
          />
        </div>
      ) : (
        <>
          {attention && (
            <section aria-label="Needs your attention" className="mt-8">
              <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500">
                Needs your attention
              </h2>
              {attentionCards.length > 0 ? (
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  {attentionCards.map((c) =>
                    c ? (
                      <Card key={c.key}>
                        <div className="flex items-start gap-4">
                          <span
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${c.iconClass}`}
                          >
                            {c.icon}
                          </span>
                          <div className="min-w-0">
                            <p className="text-2xl font-semibold text-ink-900">
                              {c.count}
                            </p>
                            <p className="text-sm font-medium text-ink-800">
                              {c.title}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-ink-500">
                          {c.explainer}
                        </p>
                        <Link
                          href={c.href}
                          className="mt-2 inline-block text-xs font-medium text-accent-700 underline-offset-2 hover:underline"
                        >
                          {c.linkLabel}
                        </Link>
                      </Card>
                    ) : null
                  )}
                </div>
              ) : (
                <Card className="mt-3">
                  <p className="text-sm text-ink-600">
                    All clear — nothing needs your attention right now.
                  </p>
                </Card>
              )}
            </section>
          )}

          <div className="mt-8 grid items-start gap-8 lg:grid-cols-3">
            {overview.commerce && (
              <section aria-label="Commerce" className="lg:col-span-2">
                <SectionTitle
                  title="Commerce"
                  hint="(all time)"
                  linkHref="/dashboard/orders"
                />
                <Card>
                  <div className="grid grid-cols-2 gap-6 xl:grid-cols-4">
                    <div>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-50 text-accent-700">
                        <Wallet className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <p className="mt-2 text-xl font-semibold text-ink-900">
                        {overview.commerce.collections.length > 0 ? (
                          overview.commerce.collections.map((c) => (
                            <span key={c.currency} className="block">
                              {formatMoney(c.currency, c.amount)}
                            </span>
                          ))
                        ) : (
                          <span className="block">—</span>
                        )}
                      </p>
                      <p className="text-sm text-ink-700">
                        Paystack collections
                      </p>
                      <p className="text-xs text-ink-400">
                        Successful payments only
                      </p>
                    </div>
                    <div>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-50 text-accent-700">
                        <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <p className="mt-2 text-xl font-semibold text-ink-900">
                        {overview.commerce.paidOrders}
                      </p>
                      <p className="text-sm text-ink-700">Paid orders</p>
                      <p className="text-xs text-ink-400">
                        All completed payments
                      </p>
                    </div>
                    <div>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-50 text-accent-700">
                        <Ticket className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <p className="mt-2 text-xl font-semibold text-ink-900">
                        {overview.commerce.ticketsSold}
                      </p>
                      <p className="text-sm text-ink-700">Tickets sold</p>
                      <p className="text-xs text-ink-400">
                        Across ticketed events
                      </p>
                    </div>
                    <div>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-50 text-accent-700">
                        <Users className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <p className="mt-2 text-xl font-semibold text-ink-900">
                        {overview.commerce.registeredPurchasers}
                      </p>
                      <p className="text-sm text-ink-700">Purchasers</p>
                      <p className="text-xs text-ink-400">
                        Registered customers
                      </p>
                    </div>
                  </div>
                </Card>
              </section>
            )}

            {event !== undefined && (
              <section
                aria-label="Upcoming event"
                className="lg:row-span-2"
              >
                <SectionTitle title="Upcoming event" />
                {event ? (
                  <Card padded={false} className="overflow-hidden">
                    {event.imageUrl ? (
                      <div className="relative">
                        <img
                          src={event.imageUrl}
                          alt={`Cover image for ${event.title}`}
                          className="aspect-[16/9] w-full object-cover"
                        />
                        <span className="absolute left-3 top-3">
                          <Chip tone="success">{event.status}</Chip>
                        </span>
                      </div>
                    ) : (
                      <div className="flex aspect-[16/9] w-full items-center justify-center border-b border-border bg-ink-50">
                        <p className="text-xs text-ink-400">
                          No cover image
                        </p>
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="text-lg font-semibold tracking-tight text-ink-900">
                        {event.title}
                      </h3>
                      <p className="mt-1 text-sm text-ink-500">
                        {formatDate(event.startsAt)}
                      </p>
                      {event.venue && (
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-500">
                          <MapPin
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          {event.venue}
                        </p>
                      )}
                      {event.capacity > 0 ? (
                        <div className="mt-4">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-sm font-semibold text-ink-900">
                              {event.sold} / {event.capacity}
                              <span className="ml-2 text-xs font-normal text-ink-400">
                                Tickets sold
                              </span>
                            </p>
                            <p className="text-sm font-semibold text-ink-900">
                              {event.remaining}
                              <span className="ml-2 text-xs font-normal text-ink-400">
                                Remaining
                              </span>
                            </p>
                          </div>
                          <div
                            role="progressbar"
                            aria-valuenow={eventProgress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Tickets sold for ${event.title}`}
                            className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100"
                          >
                            <div
                              className="h-full rounded-full bg-accent-600"
                              style={{ width: `${eventProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="mt-4 text-xs text-ink-500">
                          No ticketed capacity for this event.
                        </p>
                      )}
                      {event.purchaserCount !== null && (
                        <p className="mt-3 text-xs text-ink-500">
                          {event.grossByCurrency.length > 0
                            ? `${event.grossByCurrency
                                .map((g) => formatMoney(g.currency, g.amount))
                                .join(" · ")} catalogue gross · `
                            : ""}
                          {event.purchaserCount} purchaser
                          {event.purchaserCount === 1 ? "" : "s"}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {can("events:write") ? (
                          <LinkButton
                            href={`/dashboard/events?resume=event:${event.id}`}
                            className="px-4 py-2 text-sm"
                          >
                            Manage event
                          </LinkButton>
                        ) : (
                          <LinkButton
                            href="/dashboard/events/list"
                            variant="secondary"
                            className="px-4 py-2 text-sm"
                          >
                            View events
                          </LinkButton>
                        )}
                        {event.purchaserCount !== null && (
                          <LinkButton
                            href="/dashboard/events/list"
                            variant="secondary"
                            className="px-4 py-2 text-sm"
                          >
                            View purchasers
                          </LinkButton>
                        )}
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card>
                    <p className="text-sm text-ink-600">
                      No upcoming published events.
                    </p>
                  </Card>
                )}
              </section>
            )}

            {overview.recentWork && overview.recentWork.length > 0 && (
              <section aria-label="Recent work" className="lg:col-span-2">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-semibold text-ink-800">
                    Recent work
                  </h2>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => scrollRail(-1)}
                      aria-label="Scroll recent work backwards"
                      className="rounded-full border border-border bg-surface p-1.5 text-ink-600 transition-colors hover:border-ink-300 hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollRail(1)}
                      aria-label="Scroll recent work forwards"
                      className="rounded-full border border-border bg-surface p-1.5 text-ink-600 transition-colors hover:border-ink-300 hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div
                  ref={railRef}
                  className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1"
                >
                  {overview.recentWork.map((w) => (
                    <Link
                      key={`${w.kind}-${w.id}`}
                      href={w.href}
                      className="w-52 shrink-0 snap-start overflow-hidden rounded-card border border-border bg-surface shadow-card transition-shadow hover:shadow-pop focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 sm:w-60"
                    >
                      {w.imageUrl ? (
                        <img
                          src={w.imageUrl}
                          alt={w.title}
                          loading="lazy"
                          className="aspect-[4/3] w-full object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden="true"
                          className="flex aspect-[4/3] w-full items-center justify-center bg-ink-50"
                        >
                          <span className="text-xs text-ink-400">
                            {WORK_KIND_LABELS[w.kind] ?? w.kind}
                          </span>
                        </div>
                      )}
                      <span className="block p-3">
                        <span className="block truncate text-sm font-medium text-ink-900">
                          {w.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-500">
                          {WORK_KIND_LABELS[w.kind] ?? w.kind}
                          {w.statusLabel ? ` · ${w.statusLabel}` : ""}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {overview.recentOrders && (
              <section aria-label="Recent orders" className="lg:col-span-2">
                <SectionTitle
                  title="Recent orders"
                  linkHref="/dashboard/orders"
                />
                {overview.recentOrders.length > 0 ? (
                  <Table
                    head={
                      <>
                        <Th>Customer</Th>
                        <Th>Purchase</Th>
                        <Th>Amount</Th>
                        <Th>Status</Th>
                        <Th>Placed</Th>
                        <Th>
                          <span className="sr-only">View</span>
                        </Th>
                      </>
                    }
                  >
                    {overview.recentOrders.map((o) => {
                      const op = orderOperationalStatus({
                        status: o.status,
                        paymentStatus: o.paymentStatus,
                        source: o.source,
                        fulfilledAt: o.fulfilledAt,
                        deliveryMethod: o.deliveryMethod,
                        itemTypes: o.itemTypes,
                      });
                      return (
                        <tr key={o.id}>
                          <Td>
                            <span
                              className="block max-w-[8rem] truncate font-medium text-ink-900"
                              title={o.customer}
                            >
                              {o.customer}
                            </span>
                          </Td>
                          <Td className="max-w-[10rem] truncate text-ink-600">
                            {o.purchase}
                          </Td>
                          <Td className="whitespace-nowrap text-ink-800">
                            {formatMoney(o.currency, o.amount)}
                            {o.chargeAmount !== null && o.chargeCurrency && (
                              <span className="block text-xs text-ink-400">
                                Charged{" "}
                                {formatMoney(
                                  o.chargeCurrency,
                                  o.chargeAmount
                                )}
                              </span>
                            )}
                          </Td>
                          <Td>
                            <StatusBadge tone={op.tone}>
                              {op.label}
                            </StatusBadge>
                          </Td>
                          <Td className="whitespace-nowrap text-ink-600">
                            {formatDate(o.placedAt)}
                          </Td>
                          <Td>
                            <Link
                              href="/dashboard/orders"
                              className="text-xs font-medium text-accent-700 underline-offset-2 hover:underline"
                            >
                              View →
                            </Link>
                          </Td>
                        </tr>
                      );
                    })}
                  </Table>
                ) : (
                  <Card>
                    <p className="text-sm text-ink-600">No orders yet.</p>
                  </Card>
                )}
              </section>
            )}

            {drafts !== null && drafts.length > 0 && (
              <section aria-label="Continue working">
                <SectionTitle title="Continue working" />
                <Card padded={false} className="px-4 py-2">
                  <ul className="divide-y divide-ink-100">
                    {drafts.slice(0, 7).map((d) => (
                      <li key={d.key}>
                        <Link
                          href={draftHref(d)}
                          className="group flex items-baseline justify-between gap-4 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
                        >
                          <span className="min-w-0">
                            <span className="block text-[11px] uppercase tracking-[0.14em] text-ink-500">
                              {DRAFT_DOMAIN_LABELS[d.domain] ?? d.domain} ·{" "}
                              {d.record === "new" ||
                              d.record.startsWith("new:")
                                ? "Draft"
                                : "Unfinished edit"}
                            </span>
                            <span className="mt-0.5 block truncate text-sm font-medium text-ink-900 group-hover:underline">
                              {d.title}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-xs text-ink-500">
                            {relativeTime(d.savedAt)}
                            <span
                              aria-hidden="true"
                              className="text-ink-700 transition-transform group-hover:translate-x-0.5"
                            >
                              →
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
                <p className="mt-2 text-xs text-ink-500">
                  Stored in this browser only — nothing here is published.
                </p>
              </section>
            )}
          </div>

          {drafts !== null && drafts.length === 0 && !overview.recentOrders && (
            <p className="mt-8 text-xs text-ink-500">
              Drafts you start on this device will appear here so you can pick
              up where you left off.
            </p>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
