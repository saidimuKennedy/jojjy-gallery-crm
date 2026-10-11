import { useEffect, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Alert,
  Button,
  Card,
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
  WizardSteps,
} from "@/components/ui";

interface EventOption {
  id: number;
  title: string;
  startsAt: string;
  status: string;
}

interface ReportType {
  id: number;
  name: string;
  price: number;
  allocated: number;
  sold: number;
  reserved: number;
  remaining: number;
  complimentary: number;
  checkedIn: number;
  refundedTickets: number;
  grossPaid: number;
  currency: string;
}

interface ReportData {
  event: { id: number; title: string; status: string; startsAt: string };
  definitions: Record<string, string>;
  totals: {
    allocated: number;
    sold: number;
    reserved: number;
    remaining: number;
    complimentary: number;
    checkedIn: number;
    grossPaid: number;
    refunded: number;
    netPaid: number;
    currency: string;
  };
  types: ReportType[];
}

interface Attendee {
  id: string;
  code: string;
  ticketType: string;
  source: string;
  status: string;
  holderName: string | null;
  holderEmail: string | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
  history: { action: string; at: string; by: string; reason: string | null }[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed");
  return json;
};

export default function ReportsPage() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canComp = permissions.includes("tickets:issue-complimentary");
  const canExport = permissions.includes("reporting:export");
  const canCorrect = permissions.includes("tickets:check-in-correct");

  const { data: events } = useSWR<EventOption[]>(
    "/api/tickets/events",
    (u: string) => fetcher(u).then((j) => j.data as EventOption[])
  );
  const [eventId, setEventId] = useState<string>("");
  const [tab, setTab] = useState<"report" | "attendees">("report");
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId && events && events.length > 0) setEventId(String(events[0].id));
  }, [events, eventId]);

  const { data: report, error: reportError } = useSWR<ReportData>(
    eventId ? `/api/events/${eventId}/report` : null,
    (u: string) => fetcher(u).then((j) => j.data as ReportData)
  );
  const { data: attendeesResp, mutate: mutateAttendees } = useSWR<{
    data: Attendee[];
    total: number;
  }>(
    eventId && tab === "attendees"
      ? `/api/events/${eventId}/attendees?q=${encodeURIComponent(q)}`
      : null,
    (u: string) => fetcher(u)
  );

  const reverse = async (ticket: Attendee) => {
    const reason = window.prompt("Why are you reversing this check-in?");
    if (!reason) return;
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/check-in-reversal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed");
      setNotice("Check-in reversed.");
      await mutateAttendees();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Event report — Jojjy Gallery CRM</title>
      </Head>
      <PageHeader
        title="Event report"
        subtitle="Allocated, sold, complimentary, reserved, checked-in, and net sales — every total defined."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Event">
          <Select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">Select an event…</option>
            {events?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {new Date(e.startsAt).toLocaleDateString()}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button
            variant={tab === "report" ? "primary" : "secondary"}
            onClick={() => setTab("report")}
          >
            Report
          </Button>
          <Button
            variant={tab === "attendees" ? "primary" : "secondary"}
            onClick={() => setTab("attendees")}
          >
            Attendees
          </Button>
        </div>
        {canExport && eventId && (
          <a
            href={`/api/events/${eventId}/report?format=csv`}
            className="inline-flex items-center rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 shadow-sm hover:border-ink-300 hover:bg-ink-50"
          >
            Export CSV
          </a>
        )}
        {canComp && eventId && (
          <CompWizard
            eventId={eventId}
            types={report?.types ?? []}
            onDone={(msg) => setNotice(msg)}
          />
        )}
      </div>

      {notice && (
        <div className="mb-4">
          <Alert tone="info">{notice}</Alert>
        </div>
      )}
      {reportError && <Alert tone="danger">Could not load the report.</Alert>}

      {tab === "report" && report && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { k: "allocated", label: "Allocated" },
              { k: "sold", label: "Sold" },
              { k: "complimentary", label: "Complimentary" },
              { k: "reserved", label: "Reserved" },
              { k: "remaining", label: "Remaining" },
              { k: "checkedIn", label: "Checked in" },
              { k: "grossPaid", label: `Gross paid (${report.totals.currency})` },
              { k: "refunded", label: `Refunded (${report.totals.currency})` },
              { k: "netPaid", label: `Net paid (${report.totals.currency})` },
            ].map((item) => (
              <Card key={item.k}>
                <p className="text-xs uppercase tracking-[0.14em] text-ink-500">
                  {item.label}
                </p>
                <p className="mt-1 text-xl font-light text-ink-900">
                  {report.totals[item.k as keyof typeof report.totals]}
                </p>
              </Card>
            ))}
          </div>

          <Table
            head={
              <>
                <Th>Tier</Th>
                <Th>Price</Th>
                <Th>Allocated</Th>
                <Th>Sold</Th>
                <Th>Complimentary</Th>
                <Th>Reserved</Th>
                <Th>Remaining</Th>
                <Th>Checked in</Th>
                <Th>Gross paid</Th>
              </>
            }
          >
            {report.types.map((t) => (
              <tr key={t.id}>
                <Td>{t.name}</Td>
                <Td>
                  {t.currency} {t.price.toLocaleString()}
                </Td>
                <Td>{t.allocated}</Td>
                <Td>{t.sold}</Td>
                <Td>{t.complimentary}</Td>
                <Td>{t.reserved}</Td>
                <Td>{t.remaining}</Td>
                <Td>{t.checkedIn}</Td>
                <Td>{t.grossPaid.toLocaleString()}</Td>
              </tr>
            ))}
          </Table>

          <details className="mt-6">
            <summary className="cursor-pointer text-xs uppercase tracking-[0.14em] text-ink-500">
              Definitions
            </summary>
            <ul className="mt-2 space-y-1 text-sm text-ink-600">
              {Object.entries(report.definitions).map(([k, v]) => (
                <li key={k}>
                  <span className="font-medium">{k}</span> — {v}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}

      {tab === "attendees" && (
        <>
          <div className="mb-4">
            <Field label="Search">
              <TextField
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="code, name, or email"
              />
            </Field>
          </div>
          <Table
            head={
              <>
                <Th>Attendee</Th>
                <Th>Ticket</Th>
                <Th>Tier</Th>
                <Th>Source</Th>
                <Th>State</Th>
                <Th>Checked in</Th>
                <Th />
              </>
            }
          >
            {(attendeesResp?.data ?? []).length === 0 && (
              <tr>
                <Td className="text-ink-500">No attendees found.</Td>
              </tr>
            )}
            {(attendeesResp?.data ?? []).map((t) => (
              <tr key={t.id}>
                <Td>
                  {t.holderName || "Guest"}
                  {t.holderEmail && (
                    <span className="block text-xs text-ink-400">
                      {t.holderEmail}
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="font-mono text-xs">{t.code}</span>
                </Td>
                <Td>{t.ticketType}</Td>
                <Td>
                  <StatusBadge
                    tone={t.source === "COMPLIMENTARY" ? "info" : "neutral"}
                  >
                    {t.source === "COMPLIMENTARY" ? "Complimentary" : "Paid"}
                  </StatusBadge>
                </Td>
                <Td>
                  <StatusBadge
                    tone={
                      t.status === "CHECKED_IN"
                        ? "success"
                        : t.status === "VALID"
                          ? "neutral"
                          : "danger"
                    }
                  >
                    {t.status}
                  </StatusBadge>
                </Td>
                <Td>
                  {t.checkedInAt
                    ? `${new Date(t.checkedInAt).toLocaleTimeString()} · ${
                        t.checkedInBy ?? ""
                      }`
                    : "—"}
                </Td>
                <Td>
                  {canCorrect && t.checkedInAt && (
                    <Button variant="ghost" onClick={() => reverse(t)}>
                      Reverse
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </DashboardLayout>
  );
}

function CompWizard({
  eventId,
  types,
  onDone,
}: {
  eventId: string;
  types: ReportType[];
  onDone: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [typeId, setTypeId] = useState<string>("");
  const [attendees, setAttendees] = useState<{ name: string; email: string }[]>([
    { name: "", email: "" },
  ]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = types.find((t) => String(t.id) === typeId);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/complimentary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketTypeId: Number(typeId),
          reason,
          attendees: attendees.filter((a) => a.name.trim() || a.email.trim()),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed");
      onDone(`Issued ${json.data.quantity} complimentary ticket(s).`);
      setOpen(false);
      setStep(0);
      setTypeId("");
      setAttendees([{ name: "", email: "" }]);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Issue complimentary
      </Button>
      <Modal
        open={open}
        title="Issue complimentary tickets"
        onClose={() => setOpen(false)}
        wide
        footer={
          <>
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {step < 2 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 && !typeId}
              >
                Next
              </Button>
            ) : (
              <Button onClick={submit} disabled={busy || !reason.trim()}>
                {busy ? "…" : "Issue tickets"}
              </Button>
            )}
          </>
        }
      >
        <WizardSteps
          steps={["Ticket type", "Attendees", "Review"]}
          current={step}
        />
        {error && <Alert tone="danger">{error}</Alert>}

        {step === 0 && (
          <Field label="Ticket type" required>
            <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">Select…</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.remaining} remaining
                </option>
              ))}
            </Select>
          </Field>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-500">One attendee per ticket.</p>
            {attendees.map((a, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <TextField
                  value={a.name}
                  onChange={(e) =>
                    setAttendees((prev) =>
                      prev.map((p, idx) =>
                        idx === i ? { ...p, name: e.target.value } : p
                      )
                    )
                  }
                  placeholder={`Attendee ${i + 1} name`}
                />
                <TextField
                  value={a.email}
                  onChange={(e) =>
                    setAttendees((prev) =>
                      prev.map((p, idx) =>
                        idx === i ? { ...p, email: e.target.value } : p
                      )
                    )
                  }
                  placeholder="email"
                />
              </div>
            ))}
            <Button
              variant="secondary"
              onClick={() =>
                setAttendees((prev) => [...prev, { name: "", email: "" }])
              }
            >
              Add attendee
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-ink-700">
              {selected?.name} ·{" "}
              {attendees.filter((a) => a.name.trim() || a.email.trim()).length}{" "}
              ticket(s) · zero charge
            </p>
            <Field label="Reason (required)" required>
              <TextArea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. press/promo — approved by …"
              />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
