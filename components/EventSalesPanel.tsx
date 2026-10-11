import React, { useState } from "react";
import useSWR from "swr";
import { EmptyState, LoadingState } from "@/components/ui";

interface SalesType {
  id: number;
  name: string;
  price: number;
  quantity: number;
  quantitySold: number;
  remaining: number;
  paidItemQuantity: number;
  grossCatalogue: number;
  grossCurrency: string;
  salesStart: string | null;
  salesEnd: string | null;
}

interface Purchaser {
  orderId: string;
  customer: string;
  email: string | null;
  phone: string | null;
  lines: { ticketType: string; quantity: number; unitPrice: number }[];
  catalogueTotal: number;
  catalogueCurrency: string;
  chargeAmount: number | null;
  chargeCurrency: string | null;
  status: string;
  paymentStatus: string;
  source: string;
  paystackRef: string | null;
  createdAt: string;
}

interface SalesData {
  event: { id: number; title: string; slug: string; status: string; startsAt: string };
  reconciliation: {
    counterSold: number;
    ticketRows: number;
    paidItemQuantity: number;
  };
  totals: {
    capacity: number;
    sold: number;
    remaining: number;
    grossCatalogue: number;
    grossCurrency: string;
    purchaserOrders: number;
  };
  types: SalesType[];
  purchasers: Purchaser[];
  purchaserPage: number;
  purchaserLimit: number;
  purchaserTotal: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to load sales");
  return json.data as SalesData;
};

/**
 * Factual event sales intelligence. Every number traces to persisted rows;
 * catalogue (USD) and Paystack charge (KES) values are labelled and never
 * mixed. Purchasers are buyers — never attendees (no check-in exists).
 */
export default function EventSalesPanel({ eventId }: { eventId: number }) {
  const [page, setPage] = useState(1);
  const { data, error, isLoading } = useSWR<SalesData>(
    `/api/events/${eventId}/sales?purchaserPage=${page}&purchaserLimit=25`,
    fetcher
  );

  if (isLoading) {
    return <LoadingState label="Loading sales…" />;
  }
  if (error || !data) {
    return (
      <p className="text-sm text-red-600">
        Could not load sales. {error?.message ?? ""}
      </p>
    );
  }

  const pages = Math.max(
    1,
    Math.ceil(data.purchaserTotal / data.purchaserLimit)
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Tickets sold", value: String(data.totals.sold) },
          { label: "Remaining", value: String(data.totals.remaining) },
          {
            label: `Gross catalogue (${data.totals.grossCurrency})`,
            value: data.totals.grossCatalogue.toLocaleString(),
          },
          {
            label: "Purchaser orders",
            value: String(data.totals.purchaserOrders),
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-medium text-ink-500">{s.label}</p>
            <p className="mt-1 text-xl font-semibold text-ink-900">{s.value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs font-light text-ink-500">
        Counter {data.reconciliation.counterSold} · ticket rows{" "}
        {data.reconciliation.ticketRows} · paid item qty{" "}
        {data.reconciliation.paidItemQuantity} · capacity {data.totals.capacity}
      </p>

      <div className="overflow-hidden rounded-2xl border border-ink-100 shadow-sm">
        <table className="min-w-full divide-y divide-ink-100">
          <thead className="bg-ink-50">
            <tr>
              {["Type", "Price (USD)", "Capacity", "Sold", "Remaining", "Paid qty", "Gross (USD)"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-2 text-left text-xs font-medium text-ink-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-ink-100">
            {data.types.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-sm text-ink-500">
                  No ticket types yet.
                </td>
              </tr>
            )}
            {data.types.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2 text-sm text-black">{t.name}</td>
                <td className="px-4 py-2 text-sm">{t.price.toLocaleString()}</td>
                <td className="px-4 py-2 text-sm">{t.quantity}</td>
                <td className="px-4 py-2 text-sm">{t.quantitySold}</td>
                <td className="px-4 py-2 text-sm">{t.remaining}</td>
                <td className="px-4 py-2 text-sm">{t.paidItemQuantity}</td>
                <td className="px-4 py-2 text-sm">
                  {t.grossCatalogue.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="font-display text-xs uppercase tracking-[0.2em] text-ink-500 mb-3">
          Purchasers ({data.purchaserTotal})
        </p>
        {data.purchasers.length === 0 ? (
          <p className="text-sm font-light text-ink-500">
            No purchasers yet.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-ink-100 border-y border-ink-100">
              {data.purchasers.map((p) => (
                <li key={p.orderId} className="py-3 text-sm font-light">
                  <p className="text-ink-900">
                    {p.customer}{" "}
                    <span className="text-ink-500">· {p.email}</span>
                    {p.phone && (
                      <span className="text-ink-500"> · {p.phone}</span>
                    )}
                  </p>
                  <p className="mt-1 text-ink-600">
                    {p.lines
                      .map((l) => `${l.ticketType} × ${l.quantity}`)
                      .join("; ")}
                    {" · "}
                    {p.catalogueCurrency}{" "}
                    {p.catalogueTotal.toLocaleString()}
                    {p.chargeAmount != null && p.chargeCurrency && (
                      <span className="text-ink-500">
                        {" "}
                        (charged {p.chargeCurrency}{" "}
                        {p.chargeAmount.toLocaleString()})
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {new Date(p.createdAt).toLocaleDateString()} · {p.status} ·{" "}
                    <a
                      href={`/dashboard/orders?q=${encodeURIComponent(
                        p.orderId.slice(0, 8)
                      )}`}
                      className="underline hover:text-black"
                    >
                      order {p.orderId.slice(0, 8)}
                    </a>
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between text-sm text-ink-600">
              <p>
                Page {data.purchaserPage} of {pages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((v) => Math.max(1, v - 1))}
                  className="rounded-full border border-ink-200 bg-white px-4 py-1.5 text-sm font-medium text-ink-700 shadow-sm hover:bg-ink-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => setPage((v) => v + 1)}
                  className="rounded-full border border-ink-200 bg-white px-4 py-1.5 text-sm font-medium text-ink-700 shadow-sm hover:bg-ink-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
