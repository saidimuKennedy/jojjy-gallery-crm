import { useEffect, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { Plus, Trash2, Pencil } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ComingSoon";

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
  price: number;
  quantity: number;
  quantitySold: number;
  salesStart: string | null;
  salesEnd: string | null;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data;
};

const inputClass =
  "mt-1 w-full border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-950";
const labelClass =
  "block text-xs font-medium uppercase tracking-wide text-ink-500";

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

  useEffect(() => {
    if (events?.length && eventId === "") {
      setEventId(events[0].id);
    }
  }, [events, eventId]);

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
      mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!eventId || !confirm("Delete this ticket type?")) return;
    const res = await fetch(
      `/api/events/${eventId}/ticket-types?id=${id}`,
      { method: "DELETE" }
    );
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
        description="Ticket types, sales windows, and inventory per event."
      />

      <div className="mb-6 max-w-sm">
        <label className={labelClass}>Event</label>
        <select
          className={inputClass}
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
        </select>
      </div>

      {!eventId ? (
        <p className="text-sm text-ink-500">Choose an event to manage tickets.</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            {isLoading ? (
              <p className="text-sm text-ink-500">Loading ticket types…</p>
            ) : error ? (
              <p className="text-sm text-red-600">{error.message}</p>
            ) : !ticketTypes?.length ? (
              <p className="text-sm text-ink-500">No ticket types yet.</p>
            ) : (
              <div className="overflow-x-auto border border-ink-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Qty</th>
                      <th className="px-4 py-3 font-medium">Sold</th>
                      <th className="px-4 py-3 font-medium">Sales window</th>
                      <th className="px-4 py-3 font-medium text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticketTypes.map((tt) => (
                      <tr key={tt.id} className="border-b border-ink-100">
                        <td className="px-4 py-3 font-medium">{tt.name}</td>
                        <td className="px-4 py-3">
                          KES {Number(tt.price).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">{tt.quantity}</td>
                        <td className="px-4 py-3">{tt.quantitySold}</td>
                        <td className="px-4 py-3 text-xs text-ink-600">
                          {tt.salesStart
                            ? new Date(tt.salesStart).toLocaleString()
                            : "Open"}
                          {" → "}
                          {tt.salesEnd
                            ? new Date(tt.salesEnd).toLocaleString()
                            : "No end"}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => startEdit(tt)}
                            className="p-1.5 text-ink-600 hover:text-ink-950"
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4 inline" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(tt.id)}
                            className="p-1.5 text-ink-600 hover:text-red-700"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {editing && (
              <form
                onSubmit={saveEdit}
                className="mt-6 space-y-3 border border-ink-200 bg-ink-50 p-4"
              >
                <h3 className="text-sm font-semibold text-ink-950">
                  Edit ticket type
                </h3>
                <div>
                  <label className={labelClass}>Name</label>
                  <input
                    className={inputClass}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Price (KES)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputClass}
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Quantity</label>
                    <input
                      type="number"
                      min={editing.quantitySold}
                      className={inputClass}
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Sales start</label>
                    <input
                      type="datetime-local"
                      className={inputClass}
                      value={editSalesStart}
                      onChange={(e) => setEditSalesStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Sales end</label>
                    <input
                      type="datetime-local"
                      className={inputClass}
                      value={editSalesEnd}
                      onChange={(e) => setEditSalesEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="bg-ink-950 px-4 py-2 text-sm text-white hover:bg-ink-800 disabled:opacity-50"
                  >
                    {editSaving ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="border border-ink-300 px-4 py-2 text-sm text-ink-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <form
            onSubmit={create}
            className="space-y-3 border border-ink-200 bg-white p-4 h-fit"
          >
            <h2 className="text-sm font-semibold text-ink-950">Add ticket type</h2>
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
            <div>
              <label className={labelClass}>Name</label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Price (KES)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Quantity</label>
              <input
                type="number"
                min="0"
                className={inputClass}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Sales start (optional)</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={salesStart}
                onChange={(e) => setSalesStart(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Sales end (optional)</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={salesEnd}
                onChange={(e) => setSalesEnd(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 bg-ink-950 px-4 py-2 text-sm text-white hover:bg-ink-800 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {saving ? "Adding…" : "Add ticket type"}
            </button>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
