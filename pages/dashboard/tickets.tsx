import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import useSWR from "swr";
import { Pencil, Plus, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useFormDraft } from "@/hooks/useFormDraft";
import {
  Button,
  Card,
  DateTimeField,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  SectionHeading,
  Select,
  Table,
  Td,
  TextField,
  Th,
} from "@/components/ui";

type EventOption = {
  id: number;
  title: string;
  slug: string;
  status: string;
};

type TicketType = {
  id: number;
  eventId: number;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  quantitySold: number;
  quantityReserved: number;
  salesStart: string | null;
  salesEnd: string | null;
  archivedAt: string | null;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data;
};

const EMPTY_TICKET = {
  name: "",
  price: "",
  quantity: "",
  salesStart: "",
  salesEnd: "",
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export default function TicketsPage() {
  const { data: events } = useSWR<EventOption[]>("/api/events", fetcher);
  const [eventId, setEventId] = useState<number | "">("");
  const {
    data: ticketTypes,
    error,
    isLoading,
    mutate,
  } = useSWR<TicketType[]>(
    eventId ? `/api/events/${eventId}/ticket-types` : null,
    fetcher
  );

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [salesStart, setSalesStart] = useState("");
  const [salesEnd, setSalesEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editing, setEditing] = useState<TicketType | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editSalesStart, setEditSalesStart] = useState("");
  const [editSalesEnd, setEditSalesEnd] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const createDraft = useFormDraft({
    draftKey: eventId ? `jenga:crm:draft:ticket:new:${eventId}` : null,
    values: { name, price, quantity, salesStart, salesEnd },
    emptyValues: EMPTY_TICKET,
    onRestore: (v) => {
      setName(v.name ?? "");
      setPrice(v.price ?? "");
      setQuantity(v.quantity ?? "");
      setSalesStart(v.salesStart ?? "");
      setSalesEnd(v.salesEnd ?? "");
    },
    enabled: eventId !== "",
  });

  const editDraft = useFormDraft({
    draftKey: editing ? `jenga:crm:draft:ticket:${editing.id}` : null,
    values: {
      name: editName,
      price: editPrice,
      quantity: editQuantity,
      salesStart: editSalesStart,
      salesEnd: editSalesEnd,
    },
    emptyValues: EMPTY_TICKET,
    onRestore: (v) => {
      setEditName(v.name ?? "");
      setEditPrice(v.price ?? "");
      setEditQuantity(v.quantity ?? "");
      setEditSalesStart(v.salesStart ?? "");
      setEditSalesEnd(v.salesEnd ?? "");
    },
    enabled: editing !== null,
  });

  useEffect(() => {
    if (events?.length && eventId === "") {
      setEventId(events[0].id);
    }
  }, [events, eventId]);

  const router = useRouter();
  const eventPreselected = useRef(false);
  useEffect(() => {
    if (eventPreselected.current || !router.isReady || !events?.length) return;
    const raw = router.query.event;
    const token = Array.isArray(raw) ? raw[0] : raw;
    if (!token || !events.some((e) => String(e.id) === token)) return;
    eventPreselected.current = true;
    setEventId(Number(token));
    void router.replace(router.pathname, undefined, { shallow: true });
  });

  const startEdit = (tt: TicketType) => {
    setEditing(tt);
    setEditName(tt.name);
    setEditPrice(String(tt.price));
    setEditQuantity(String(tt.quantity));
    setEditSalesStart(toDatetimeLocal(tt.salesStart));
    setEditSalesEnd(toDatetimeLocal(tt.salesEnd));
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/ticket-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price: parseFloat(price),
          quantity: parseInt(quantity, 10),
          salesStart: fromDatetimeLocal(salesStart),
          salesEnd: fromDatetimeLocal(salesEnd),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Create failed");
      setName("");
      setPrice("");
      setQuantity("");
      setSalesStart("");
      setSalesEnd("");
      createDraft.clear();
      mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !editing) return;
    setEditSaving(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/ticket-types/${editing.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName,
            price: parseFloat(editPrice),
            quantity: parseInt(editQuantity, 10),
            salesStart: fromDatetimeLocal(editSalesStart),
            salesEnd: fromDatetimeLocal(editSalesEnd),
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Update failed");
      setEditing(null);
      editDraft.clear();
      mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditSaving(false);
    }
  };

  const archive = async (tt: TicketType) => {
    if (!eventId) return;
    const next = !tt.archivedAt;
    if (
      !confirm(
        next
          ? "Archive this ticket type? It will stop selling but be kept for history."
          : "Restore this ticket type to sale?"
      )
    )
      return;
    const res = await fetch(`/api/events/${eventId}/ticket-types/${tt.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: next }),
    });
    if (!res.ok) {
      const json = await res.json();
      alert(json.message || "Failed");
      return;
    }
    mutate();
  };

  const remove = async (id: number) => {
    if (!eventId || !confirm("Delete this ticket type?")) return;
    const res = await fetch(`/api/events/${eventId}/ticket-types?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = await res.json();
      alert(json.message || "Delete failed");
      return;
    }
    mutate();
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Tickets — Jojjy Gallery CRM</title>
      </Head>
      <PageHeader
        title="Tickets"
        subtitle="Ticket types, sales windows, and inventory per event."
      />

      <div className="mb-6 max-w-sm">
        <Field label="Event">
          <Select
            value={eventId}
            onChange={(e) =>
              setEventId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">Select an event</option>
            {(events || []).map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} ({ev.status})
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {!eventId ? (
        <EmptyState title="Choose an event" description="Select an event to manage its tickets." />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            {isLoading ? (
              <LoadingState label="Loading ticket types…" />
            ) : error ? (
              <ErrorState message={error.message} onRetry={() => mutate()} />
            ) : !ticketTypes?.length ? (
              <EmptyState
                title="No ticket types yet"
                description="Add a tier using the form on the right."
              />
            ) : (
              <Table
                head={
                  <>
                    <Th>Name</Th>
                    <Th>Price</Th>
                    <Th>Allocated</Th>
                    <Th>Sold</Th>
                    <Th>Reserved</Th>
                    <Th>Sales window</Th>
                    <Th className="text-right" />
                  </>
                }
              >
                {ticketTypes.map((tt) => (
                  <tr key={tt.id}>
                    <Td>
                      <span className="font-medium text-ink-900">{tt.name}</span>
                      {tt.archivedAt && (
                        <span className="ml-2 text-xs text-ink-400">archived</span>
                      )}
                    </Td>
                    <Td>USD {Number(tt.price).toLocaleString()}</Td>
                    <Td>{tt.quantity}</Td>
                    <Td>{tt.quantitySold}</Td>
                    <Td>{tt.quantityReserved}</Td>
                    <Td className="text-xs text-ink-500">
                      {tt.salesStart
                        ? new Date(tt.salesStart).toLocaleString()
                        : "Open"}
                      {" → "}
                      {tt.salesEnd
                        ? new Date(tt.salesEnd).toLocaleString()
                        : "No end"}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          onClick={() => archive(tt)}
                        >
                          {tt.archivedAt ? "Restore" : "Archive"}
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-2 py-1"
                          onClick={() => startEdit(tt)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => remove(tt.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}

            {editing && (
              <Card className="mt-6">
                <form onSubmit={saveEdit} className="space-y-3">
                  <SectionHeading>Edit ticket type</SectionHeading>
                  {editDraft.recovered && (
                    <p className="text-xs text-ink-500">
                      Draft recovered —{" "}
                      <button
                        type="button"
                        onClick={() => {
                          editDraft.discard();
                          if (editing) startEdit(editing);
                        }}
                        className="text-accent-700 underline-offset-2 hover:underline"
                      >
                        discard
                      </button>
                    </p>
                  )}
                  <Field label="Name" required>
                    <TextField
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Price (USD)" required>
                      <TextField
                        type="number"
                        min="0"
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        required
                      />
                    </Field>
                    <Field
                      label="Quantity"
                      required
                      hint={`Min ${editing.quantitySold + editing.quantityReserved} (sold + reserved)`}
                    >
                      <TextField
                        type="number"
                        min={editing.quantitySold + editing.quantityReserved}
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        required
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Sales start">
                      <DateTimeField
                        value={editSalesStart}
                        onChange={(e) => setEditSalesStart(e.target.value)}
                      />
                    </Field>
                    <Field label="Sales end">
                      <DateTimeField
                        value={editSalesEnd}
                        onChange={(e) => setEditSalesEnd(e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={editSaving}>
                      {editSaving ? "Saving…" : "Save changes"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                  {editDraft.savedAt && (
                    <p className="text-right text-[11px] text-ink-400">
                      Draft saved locally
                    </p>
                  )}
                </form>
              </Card>
            )}
          </div>

          <Card className="h-fit">
            <form onSubmit={create} className="space-y-3">
              <SectionHeading>Add ticket type</SectionHeading>
              {createDraft.recovered && (
                <p className="text-xs text-ink-500">
                  Draft recovered —{" "}
                  <button
                    type="button"
                    onClick={() => {
                      createDraft.discard();
                      setName("");
                      setPrice("");
                      setQuantity("");
                      setSalesStart("");
                      setSalesEnd("");
                    }}
                    className="text-accent-700 underline-offset-2 hover:underline"
                  >
                    discard
                  </button>
                </p>
              )}
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <Field label="Name" required>
                <TextField
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Price (USD)" required>
                <TextField
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </Field>
              <Field label="Quantity" required>
                <TextField
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </Field>
              <Field label="Sales start (optional)">
                <DateTimeField
                  value={salesStart}
                  onChange={(e) => setSalesStart(e.target.value)}
                />
              </Field>
              <Field label="Sales end (optional)">
                <DateTimeField
                  value={salesEnd}
                  onChange={(e) => setSalesEnd(e.target.value)}
                />
              </Field>
              <Button type="submit" disabled={saving} className="w-full">
                <Plus className="h-4 w-4" />
                {saving ? "Adding…" : "Add ticket type"}
              </Button>
              {createDraft.savedAt && (
                <p className="text-right text-[11px] text-ink-400">
                  Draft saved locally
                </p>
              )}
            </form>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
