import { useEffect, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { Plus, Edit3, Trash2, X, Upload } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ComingSoon";

type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";

type EventRow = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  venue: string | null;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  status: EventStatus;
  publishAt: string | null;
  directions: string | null;
  openingHours: string | null;
  artistTalkAt: string | null;
};

type EventForm = {
  title: string;
  slug: string;
  description: string;
  venue: string;
  imageUrl: string;
  startsAt: string;
  endsAt: string;
  publishAt: string;
  directions: string;
  openingHoursStart: string;
  openingHoursEnd: string;
  artistTalkAt: string;
};

const emptyForm = (): EventForm => ({
  title: "",
  slug: "",
  description: "",
  venue: "",
  imageUrl: "",
  startsAt: "",
  endsAt: "",
  publishAt: "",
  directions: "",
  openingHoursStart: "",
  openingHoursEnd: "",
  artistTalkAt: "",
});

type TicketType = {
  id: number;
  eventId: number;
  name: string;
  price: number;
  quantity: number;
  quantitySold: number;
};

// Best-effort parse of a legacy "9:00 AM – 6:00 PM" style string back into
// two <input type="time"> values (24h HH:MM). Unparseable strings just leave
// the pickers blank rather than guessing.
function parseOpeningHours(value: string | null | undefined): {
  start: string;
  end: string;
} {
  if (!value) return { start: "", end: "" };
  const parts = value.split(/[–—-]/).map((s) => s.trim());
  if (parts.length !== 2) return { start: "", end: "" };
  const to24h = (s: string) => {
    const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return "";
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ampm = m[3]?.toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  };
  return { start: to24h(parts[0]), end: to24h(parts[1]) };
}

function formatOpeningHours(start: string, end: string): string {
  if (!start && !end) return "";
  const to12h = (t: string) => {
    if (!t) return "";
    const [hStr, min] = t.split(":");
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${min} ${ampm}`;
  };
  return `${to12h(start)} – ${to12h(end)}`;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data as EventRow[];
};

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputClass =
  "mt-1 w-full border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-950";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-ink-500";

const ticketTypesFetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data as TicketType[];
};

function TicketTypesSection({ eventId }: { eventId: number }) {
  const { data: ticketTypes, mutate } = useSWR(
    `/api/events/${eventId}/ticket-types`,
    ticketTypesFetcher
  );
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTicketType = async () => {
    if (!name || !price || !quantity) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/ticket-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price, quantity }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to add");
      setName("");
      setPrice("");
      setQuantity("");
      await mutate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const removeTicketType = async (id: number) => {
    if (!confirm("Delete this ticket type?")) return;
    const res = await fetch(
      `/api/events/${eventId}/ticket-types?id=${id}`,
      { method: "DELETE" }
    );
    const json = await res.json();
    if (!res.ok) {
      alert(json.message || "Delete failed");
      return;
    }
    mutate();
  };

  return (
    <div className="border-t border-ink-100 pt-4">
      <p className={labelClass}>Ticket types (sets the price customers pay)</p>
      {error && (
        <p className="mt-2 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {ticketTypes && ticketTypes.length > 0 && (
        <ul className="mt-2 divide-y divide-ink-100 border border-ink-200">
          {ticketTypes.map((tt) => (
            <li
              key={tt.id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span>
                {tt.name} — ${tt.price.toFixed(2)} · {tt.quantitySold}/
                {tt.quantity} sold
              </span>
              <button
                type="button"
                onClick={() => removeTicketType(tt.id)}
                className="text-ink-500 hover:text-red-700"
                aria-label="Delete ticket type"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <input
          className={inputClass + " !mt-0"}
          placeholder="Name (e.g. General)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={inputClass + " !mt-0"}
          placeholder="Price (USD)"
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <input
          className={inputClass + " !mt-0"}
          placeholder="Quantity"
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <button
          type="button"
          onClick={addTicketType}
          disabled={adding || !name || !price || !quantity}
          className="border border-ink-300 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}

export default function EventsPage() {
  const { data: events, error, isLoading, mutate } = useSWR(
    "/api/events",
    fetcher
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const { start, end } = parseOpeningHours(editing.openingHours);
      setForm({
        title: editing.title,
        slug: editing.slug,
        description: editing.description || "",
        venue: editing.venue || "",
        imageUrl: editing.imageUrl || "",
        startsAt: toLocalInput(editing.startsAt),
        endsAt: toLocalInput(editing.endsAt),
        publishAt: toLocalInput(editing.publishAt),
        directions: editing.directions || "",
        openingHoursStart: start,
        openingHoursEnd: end,
        artistTalkAt: toLocalInput(editing.artistTalkAt),
      });
    } else {
      setForm(emptyForm());
    }
  }, [editing, open]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (event: EventRow) => {
    setEditing(event);
    setFormError(null);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const onTitleChange = (title: string) => {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-*|-$/g, "");
    setForm((prev) => ({
      ...prev,
      title,
      slug: editing ? prev.slug : slug,
    }));
  };

  const save = async (
    statusOverride?: EventStatus,
    publishAtOverride?: string | null
  ) => {
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        slug: form.slug,
        description: form.description,
        venue: form.venue,
        imageUrl: form.imageUrl,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        artistTalkAt: form.artistTalkAt
          ? new Date(form.artistTalkAt).toISOString()
          : null,
        publishAt: form.publishAt
          ? new Date(form.publishAt).toISOString()
          : null,
        directions: form.directions,
        openingHours: formatOpeningHours(
          form.openingHoursStart,
          form.openingHoursEnd
        ),
      };
      if (statusOverride) payload.status = statusOverride;
      if (publishAtOverride !== undefined) payload.publishAt = publishAtOverride;

      const res = await fetch(
        editing ? `/api/events/${editing.id}` : "/api/events",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Save failed");
      await mutate();
      close();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save();
  };

  const handleCancelEvent = async () => {
    if (!confirm("Cancel this event? This cannot be undone via the form."))
      return;
    await save("CANCELLED");
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this event?")) return;
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
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
        <title>Events — Jojjy Gallery CRM</title>
      </Head>
      <PageHeader
        title="Events"
        description="Publish and schedule ticketed events."
      >
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-ink-950 px-4 py-2 text-sm text-white hover:bg-ink-800"
        >
          <Plus className="h-4 w-4" />
          New event
        </button>
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-ink-500">Loading events…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : !events?.length ? (
        <p className="text-sm text-ink-500">No events yet.</p>
      ) : (
        <div className="overflow-x-auto border border-ink-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Starts</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Venue</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-ink-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-950">{event.title}</div>
                    <div className="text-xs text-ink-500">{event.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-700">
                    {new Date(event.startsAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs uppercase tracking-wide text-ink-600">
                      {event.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{event.venue || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(event)}
                        className="p-1.5 text-ink-600 hover:text-ink-950"
                        aria-label="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(event.id)}
                        className="p-1.5 text-ink-600 hover:text-red-700"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/40 px-4 py-10">
          <div className="w-full max-w-2xl border border-ink-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
              <h2 className="text-lg font-semibold">
                {editing ? "Edit event" : "New event"}
              </h2>
              <button type="button" onClick={close} aria-label="Close">
                <X className="h-5 w-5 text-ink-500" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4 px-5 py-5">
              {formError && (
                <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Title</label>
                  <input
                    className={inputClass}
                    value={form.title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Slug</label>
                  <input
                    className={inputClass}
                    value={form.slug}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, slug: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Publish at</label>
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={form.publishAt}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, publishAt: e.target.value }))
                    }
                  />
                  <p className="mt-1 text-xs text-ink-500">
                    Leave blank to publish immediately.
                  </p>
                </div>
                <div>
                  <label className={labelClass}>Starts at</label>
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={form.startsAt}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, startsAt: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Ends at</label>
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={form.endsAt}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, endsAt: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Venue</label>
                  <input
                    className={inputClass}
                    value={form.venue}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, venue: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Artist talk at</label>
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={form.artistTalkAt}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, artistTalkAt: e.target.value }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Image</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      className={inputClass + " !mt-0"}
                      placeholder="https://…"
                      value={form.imageUrl}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, imageUrl: e.target.value }))
                      }
                    />
                    <label className="inline-flex cursor-pointer items-center gap-1 border border-ink-300 px-3 text-sm">
                      <Upload className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setFormError(null);
                          try {
                            const body = new FormData();
                            body.append("file", file);
                            const res = await fetch("/api/upload/image", {
                              method: "POST",
                              body,
                            });
                            const json = await res.json();
                            if (!res.ok)
                              throw new Error(json.message || "Upload failed");
                            setForm((p) => ({ ...p, imageUrl: json.imageUrl }));
                          } catch (err) {
                            setFormError((err as Error).message);
                          }
                        }}
                      />
                    </label>
                  </div>
                  {form.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.imageUrl}
                      alt=""
                      className="mt-2 h-24 w-24 border border-ink-200 object-cover"
                    />
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Description</label>
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={form.description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, description: e.target.value }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Directions (Google Maps link)</label>
                  <input
                    type="url"
                    className={inputClass}
                    placeholder="https://maps.google.com/?q=…"
                    value={form.directions}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, directions: e.target.value }))
                    }
                  />
                  <p className="mt-1 text-xs text-ink-500">
                    Paste a Google Maps share link — open the location in
                    Maps, tap Share, copy the link.
                  </p>
                </div>
                <div>
                  <label className={labelClass}>Opening hours — from</label>
                  <input
                    type="time"
                    className={inputClass}
                    value={form.openingHoursStart}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        openingHoursStart: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Opening hours — to</label>
                  <input
                    type="time"
                    className={inputClass}
                    value={form.openingHoursEnd}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        openingHoursEnd: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              {editing && <TicketTypesSection eventId={editing.id} />}
              <div className="flex items-center justify-between gap-2 border-t border-ink-100 pt-4">
                <div className="flex gap-2">
                  {editing && (
                    <button
                      type="button"
                      onClick={handleCancelEvent}
                      disabled={saving}
                      className="px-4 py-2 text-sm text-red-700 hover:bg-red-50 hover:text-red-900 disabled:opacity-50"
                    >
                      Cancel event
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => save("PUBLISHED", null)}
                    disabled={saving}
                    className="px-4 py-2 text-sm text-ink-700 hover:text-ink-950 disabled:opacity-50"
                  >
                    Publish now
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 text-sm text-ink-700 hover:text-ink-950"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-ink-950 px-4 py-2 text-sm text-white hover:bg-ink-800 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : editing ? "Update" : "Create"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
