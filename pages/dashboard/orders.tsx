import { Fragment, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ComingSoon";

type OrderRow = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  chargeAmount: number | null;
  chargeCurrency: string | null;
  customerName: string | null;
  phoneNumber: string | null;
  deliveryNotes: string | null;
  fulfilledAt: string | null;
  deliveryMethod: string | null;
  deliveryAddress: string | null;
  packaging: string | null;
  createdAt: string;
  customerEmail: string;
  customerUsername: string;
  items: { itemType: string; quantity: number; unitPrice: number; label: string }[];
  tickets: { code: string; ticketType: string }[];
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data as OrderRow[];
};

const inputClass =
  "border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black bg-white";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-ink-500";

export default function OrdersPage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q.trim()) params.set("q", q.trim());
  const qs = params.toString();
  const { data: orders, error, mutate } = useSWR<OrderRow[]>(
    `/api/orders${qs ? `?${qs}` : ""}`,
    fetcher
  );

  const markFulfilled = async (id: string) => {
    if (!confirm("Mark this order fulfilled (shipped / handed over)?")) return;
    setBusyId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/orders/${id}`, { method: "PATCH" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed");
      setNotice("Order marked fulfilled.");
      await mutate();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Orders — Jojjy Gallery CRM</title>
      </Head>
      <PageHeader
        title="Orders"
        description="Who bought what, payment state, and physical fulfilment."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div>
          <label className={labelClass}>Status</label>
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Search</label>
          <input
            className={inputClass}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, reference…"
          />
        </div>
      </div>

      {notice && <p className="mb-4 text-sm text-black">{notice}</p>}
      {error && (
        <p className="text-red-600">Failed to load orders: {error.message}</p>
      )}

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Order", "Customer", "Items", "Amount", "Payment", "Fulfilment", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders?.map((o) => (
              <Fragment key={o.id}>
                <tr>
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">
                    {o.id.slice(0, 8)}
                    <span className="block font-sans text-xs text-gray-500">
                      {new Date(o.createdAt).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {o.customerName || o.customerUsername}
                    <span className="block text-xs text-gray-500">
                      {o.customerEmail}
                    </span>
                    {o.phoneNumber && (
                      <span className="block text-xs text-gray-500">
                        {o.phoneNumber}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {o.items.map((i) => (
                      <span key={i.label} className="block">
                        {i.label} × {i.quantity}
                      </span>
                    ))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {o.currency} {o.amount.toLocaleString()}
                    {o.chargeAmount != null && o.chargeCurrency && (
                      <span className="block text-xs text-gray-500">
                        Charged {o.chargeCurrency}{" "}
                        {o.chargeAmount.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        o.status === "PAID"
                          ? "bg-green-100 text-green-800"
                          : o.status === "PENDING"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {o.fulfilledAt
                      ? `Fulfilled ${new Date(o.fulfilledAt).toLocaleDateString()}`
                      : o.deliveryMethod
                        ? "Unfulfilled"
                        : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() =>
                        setOpenId(openId === o.id ? null : o.id)
                      }
                      className="text-gray-900 hover:text-black mr-4"
                    >
                      {openId === o.id ? "Hide" : "Detail"}
                    </button>
                    {o.status === "PAID" &&
                      !o.fulfilledAt &&
                      o.deliveryMethod && (
                        <button
                          onClick={() => markFulfilled(o.id)}
                          disabled={busyId === o.id}
                          className="text-green-700 hover:text-green-900 disabled:opacity-50"
                        >
                          {busyId === o.id ? "…" : "Fulfill"}
                        </button>
                      )}
                  </td>
                </tr>
                {openId === o.id && (
                  <tr key={`${o.id}-detail`}>
                    <td colSpan={7} className="px-6 py-4 bg-gray-50 text-sm">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <p className="font-medium text-black mb-1">
                            Fulfilment
                          </p>
                          <p>Method: {o.deliveryMethod ?? "—"}</p>
                          <p>Address: {o.deliveryAddress ?? "—"}</p>
                          <p>Packaging: {o.packaging ?? "—"}</p>
                          <p>Notes: {o.deliveryNotes ?? "—"}</p>
                        </div>
                        <div>
                          <p className="font-medium text-black mb-1">Contact</p>
                          <p>Name: {o.customerName ?? "—"}</p>
                          <p>Email: {o.customerEmail}</p>
                          <p>Phone: {o.phoneNumber ?? "—"}</p>
                        </div>
                        <div>
                          <p className="font-medium text-black mb-1">Tickets</p>
                          {o.tickets.length === 0 && <p>—</p>}
                          {o.tickets.map((t) => (
                            <p key={t.code} className="font-mono">
                              {t.code}{" "}
                              <span className="font-sans">
                                ({t.ticketType})
                              </span>
                            </p>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {orders?.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">
            No orders found.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
