import { useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Alert,
  Button,
  Card,
  CurrencyField,
  Field,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  TextArea,
  TextField,
  Th,
} from "@/components/ui";

interface RefundRow {
  id: string;
  orderId: string;
  ticketId: string | null;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  providerStatus: string | null;
  paystackRefundId: string | null;
  requestedAt: string;
  approver: { id: string; name: string | null; email: string } | null;
  requester: { id: string; name: string | null; email: string } | null;
  ticket: { id: string; code: string } | null;
  order: {
    id: string;
    amount: number;
    currency: string;
    buyer: string;
    email: string | null;
    paystackRef: string | null;
  } | null;
}

interface RefundsResponse {
  data: RefundRow[];
  total: number;
  page: number;
  limit: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to load refunds");
  return json as RefundsResponse;
};

const STATUS_TONE: Record<
  string,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  REQUESTED: "warning",
  APPROVED: "info",
  SUBMITTED: "info",
  PROCESSING: "info",
  PROCESSED: "success",
  FAILED: "danger",
  NEEDS_ATTENTION: "danger",
  REJECTED: "neutral",
};

export default function RefundsPage() {
  const { data: session } = useSession();
  const me = session?.user?.id;
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<{ tone: "info" | "danger"; msg: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);

  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  qs.set("page", String(page));
  qs.set("limit", "25");
  const { data, error, mutate } = useSWR<RefundsResponse>(
    `/api/refunds?${qs.toString()}`,
    fetcher
  );
  const refunds = data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 25));

  const act = async (id: string, action: "approve" | "reject" | "reconcile") => {
    setBusyId(id);
    setNotice(null);
    try {
      let body: Record<string, unknown> | undefined;
      if (action === "reject") {
        const reason = window.prompt("Reason for rejecting this refund?");
        if (!reason) return;
        body = { reason };
      }
      const res = await fetch(`/api/refunds/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Action failed");
      setNotice({ tone: "info", msg: json.message || "Done" });
      await mutate();
    } catch (err) {
      setNotice({
        tone: "danger",
        msg: err instanceof Error ? err.message : "Action failed",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Refunds — Jojjy Gallery CRM</title>
      </Head>
      <PageHeader
        title="Refunds"
        subtitle="Requests need a different authorized approver; only a confirmed Paystack refund marks tickets invalid."
        actions={
          <Button onClick={() => setShowRequest(true)}>New refund request</Button>
        }
      />

      {notice && (
        <div className="mb-4">
          <Alert tone={notice.tone === "danger" ? "danger" : "info"}>
            {notice.msg}
          </Alert>
        </div>
      )}

      <div className="mb-4 flex items-end gap-3">
        <Field label="Status">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {Object.keys(STATUS_TONE).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {error ? (
        <Alert tone="danger">Could not load refunds.</Alert>
      ) : (
        <>
          <Table
            head={
              <>
                <Th>Requested</Th>
                <Th>Order</Th>
                <Th>Amount</Th>
                <Th>Requester</Th>
                <Th>Approver</Th>
                <Th>Provider</Th>
                <Th>Status</Th>
                <Th />
              </>
            }
          >
            {refunds.length === 0 && (
              <tr>
                <Td className="text-ink-500">No refund requests.</Td>
              </tr>
            )}
            {refunds.map((r) => {
              const selfRequested = r.requester?.id === me;
              return (
                <tr key={r.id}>
                  <Td>{new Date(r.requestedAt).toLocaleDateString()}</Td>
                  <Td>
                    <span className="text-ink-700">{r.order?.buyer ?? "—"}</span>
                    <span className="block text-xs text-ink-400">
                      {r.orderId.slice(0, 8)}
                      {r.ticket ? ` · ${r.ticket.code}` : ""}
                    </span>
                  </Td>
                  <Td>
                    {r.currency} {r.amount.toLocaleString()}
                  </Td>
                  <Td>{r.requester?.name || r.requester?.email || "—"}</Td>
                  <Td>{r.approver?.name || r.approver?.email || "—"}</Td>
                  <Td>
                    {r.providerStatus || "—"}
                    {r.paystackRefundId && (
                      <span className="block text-xs text-ink-400">
                        #{r.paystackRefundId}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge tone={STATUS_TONE[r.status] ?? "neutral"}>
                      {r.status.replace(/_/g, " ")}
                    </StatusBadge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {r.status === "REQUESTED" && (
                        <>
                          <Button
                            variant="secondary"
                            disabled={busyId === r.id || selfRequested}
                            title={
                              selfRequested
                                ? "You cannot approve your own request"
                                : undefined
                            }
                            onClick={() => act(r.id, "approve")}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={busyId === r.id}
                            onClick={() => act(r.id, "reject")}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {(r.status === "SUBMITTED" ||
                        r.status === "PROCESSING" ||
                        r.status === "NEEDS_ATTENTION") && (
                        <Button
                          variant="secondary"
                          disabled={busyId === r.id}
                          onClick={() => act(r.id, "reconcile")}
                        >
                          Refresh
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>

          <div className="mt-4 flex items-center justify-between text-sm text-ink-600">
            <p>
              Page {page} of {totalPages}
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

      <RequestRefundModal
        open={showRequest}
        onClose={() => setShowRequest(false)}
        onDone={() => {
          setShowRequest(false);
          void mutate();
        }}
      />
    </DashboardLayout>
  );
}

function RequestRefundModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [orderId, setOrderId] = useState("");
  const [ticketCode, setTicketCode] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderId.trim(),
          ticketCode: ticketCode.trim() || null,
          amount: amount.trim(),
          reason: reason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Request failed");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New refund request"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "…" : "Submit request"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-500">
        A different authorized staff member must approve this before it is sent
        to Paystack. Provide the order id (or Paystack reference), the amount,
        and why.
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Order id or Paystack reference" required>
        <TextField
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="order id or jojjy_…"
        />
      </Field>
      <Field label="Ticket code (optional — for a single ticket)">
        <TextField
          value={ticketCode}
          onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
          placeholder="leave blank to refund the whole order"
        />
      </Field>
      <Field label="Amount" required>
        <CurrencyField
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <Field label="Reason" required>
        <TextArea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </Field>
    </Modal>
  );
}
