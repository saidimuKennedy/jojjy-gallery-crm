import { Fragment, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  TextField,
  Th,
  Toolbar,
} from "@/components/ui";

type OrderRow = {
  id: string;
  status: string;
  paymentStatus: string;
  source: string;
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
  customerEmail: string | null;
  customerUsername: string | null;
  paystackRef: string | null;
  items: {
    itemType: string;
    quantity: number;
    unitPrice: number;
    label: string;
    productVariantId: number | null;
    ticketTypeId: number | null;
    artworkId: number | null;
    releaseId: number | null;
    membershipPlanId: number | null;
    eventId: number | null;
  }[];
  tickets: { code: string; ticketType: string }[];
};

interface OrdersResponse {
  data: OrderRow[];
  total: number;
  page: number;
  limit: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json as OrdersResponse;
};

function paymentTone(
  o: OrderRow
): "success" | "warning" | "danger" | "neutral" {
  if (o.paymentStatus === "SUCCESS" || o.paymentStatus === "NOT_REQUIRED")
    return "success";
  if (o.paymentStatus === "PENDING") return "warning";
  if (
    o.paymentStatus === "FAILED" ||
    o.paymentStatus === "NEEDS_ATTENTION" ||
    o.paymentStatus === "CANCELLED"
  )
    return "danger";
  return "neutral";
}

export default function OrdersPage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q.trim()) params.set("q", q.trim());
  params.set("page", String(page));
  params.set("limit", "25");
  const qs = params.toString();
  const { data, error, isLoading, mutate } = useSWR<OrdersResponse>(
    `/api/orders${qs ? `?${qs}` : ""}`,
    fetcher
  );
  const orders = data?.data;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));

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
        subtitle="Who bought what, payment state, and physical fulfilment."
      />

      <Toolbar>
        <Field label="Status">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </Field>
        <Field label="Search">
          <TextField
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Name, email, reference…"
          />
        </Field>
      </Toolbar>

      {notice && (
        <div className="mb-4">
          <Alert tone="info">{notice}</Alert>
        </div>
      )}
      {error ? (
        <ErrorState message={`Failed to load orders: ${error.message}`} onRetry={() => mutate()} />
      ) : isLoading ? (
        <LoadingState label="Loading orders…" />
      ) : orders && orders.length === 0 ? (
        <EmptyState title="No orders found" />
      ) : (
        <>
          <Table
            head={
              <>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Items</Th>
                <Th>Amount</Th>
                <Th>Payment</Th>
                <Th>Fulfilment</Th>
                <Th className="text-right" />
              </>
            }
          >
            {orders?.map((o) => (
              <Fragment key={o.id}>
                <tr>
                  <Td>
                    <span className="font-mono text-ink-900">
                      {o.id.slice(0, 8)}
                    </span>
                    <span className="block text-xs text-ink-400">
                      {new Date(o.createdAt).toLocaleString()}
                    </span>
                    {o.paystackRef && (
                      <span
                        className="block text-xs text-ink-400"
                        title={o.paystackRef}
                      >
                        ref {o.paystackRef.slice(0, 18)}…
                      </span>
                    )}
                  </Td>
                  <Td>
                    {o.customerName || o.customerUsername || "Guest buyer"}
                    <span className="block text-xs text-ink-400">
                      {o.customerEmail}
                    </span>
                    {o.phoneNumber && (
                      <span className="block text-xs text-ink-400">
                        {o.phoneNumber}
                      </span>
                    )}
                  </Td>
                  <Td className="text-ink-500">
                    {o.items.map((i) => (
                      <span key={`${i.itemType}-${i.label}`} className="block">
                        {i.label} × {i.quantity}
                        {i.eventId != null && (
                          <>
                            {" "}
                            <a
                              href="/dashboard/events"
                              className="text-accent-700 underline-offset-2 hover:underline"
                            >
                              event #{i.eventId}
                            </a>
                          </>
                        )}
                      </span>
                    ))}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {o.currency} {o.amount.toLocaleString()}
                    {o.chargeAmount != null && o.chargeCurrency && (
                      <span className="block text-xs text-ink-400">
                        Charged {o.chargeCurrency}{" "}
                        {o.chargeAmount.toLocaleString()}
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <StatusBadge tone={paymentTone(o)}>
                      {o.paymentStatus.replace(/_/g, " ")}
                    </StatusBadge>
                    {o.source === "CRM_COMPLIMENTARY" && (
                      <span className="mt-1 block text-xs text-ink-400">
                        complimentary
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-500">
                    {o.fulfilledAt
                      ? `Fulfilled ${new Date(o.fulfilledAt).toLocaleDateString()}`
                      : o.deliveryMethod
                        ? "Unfulfilled"
                        : "—"}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        onClick={() =>
                          setOpenId(openId === o.id ? null : o.id)
                        }
                      >
                        {openId === o.id ? "Hide" : "Detail"}
                      </Button>
                      {o.status === "PAID" &&
                        !o.fulfilledAt &&
                        o.deliveryMethod && (
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-xs text-green-700 hover:bg-green-50 hover:text-green-800"
                            onClick={() => markFulfilled(o.id)}
                            disabled={busyId === o.id}
                          >
                            {busyId === o.id ? "…" : "Fulfill"}
                          </Button>
                        )}
                    </div>
                  </Td>
                </tr>
                {openId === o.id && (
                  <tr key={`${o.id}-detail`}>
                    <td colSpan={7} className="bg-ink-50/60 px-4 py-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="text-sm text-ink-600">
                          <p className="mb-1 font-medium text-ink-900">
                            Fulfilment
                          </p>
                          <p>Method: {o.deliveryMethod ?? "—"}</p>
                          <p>Address: {o.deliveryAddress ?? "—"}</p>
                          <p>Packaging: {o.packaging ?? "—"}</p>
                          <p>Notes: {o.deliveryNotes ?? "—"}</p>
                        </div>
                        <div className="text-sm text-ink-600">
                          <p className="mb-1 font-medium text-ink-900">Contact</p>
                          <p>Name: {o.customerName ?? "—"}</p>
                          <p>Email: {o.customerEmail ?? "—"}</p>
                          <p>Phone: {o.phoneNumber ?? "—"}</p>
                        </div>
                        <div className="text-sm text-ink-600">
                          <p className="mb-1 font-medium text-ink-900">Tickets</p>
                          {o.tickets.length === 0 && <p>—</p>}
                          {o.tickets.map((t) => (
                            <p key={t.code} className="font-mono">
                              {t.code}{" "}
                              <span className="font-sans text-ink-400">
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
          </Table>

          <div className="mt-4 flex items-center justify-between text-sm text-ink-500">
            <p>
              {total} order{total === 1 ? "" : "s"} · page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
