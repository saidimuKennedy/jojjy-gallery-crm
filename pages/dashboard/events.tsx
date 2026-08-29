import { useEffect, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { Plus, Edit3, Trash2, X } from "lucide-react";
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
  status: EventStatus;
  directions: string;
  openingHours: string;
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
  status: "DRAFT",
  directions: "",
  openingHours: "",
  artistTalkAt: "",
});

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
      setForm({
        title: editing.title,
        slug: editing.slug,
        description: editing.description || "",
        venue: editing.venue || "",
        imageUrl: editing.imageUrl || "",
        startsAt: toLocalInput(editing.startsAt),
        endsAt: toLocalInput(editing.endsAt),
        status: editing.status,
        directions: editing.directions || "",
        openingHours: editing.openingHours || "",
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        artistTalkAt: form.artistTalkAt
          ? new Date(form.artistTalkAt).toISOString()
          : null,
      };
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
                  <label className={labelClass}>Status</label>
                  <select
                    className={inputClass}
                    value={form.status}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        status: e.target.value as EventStatus,
                      }))
                    }
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
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
                  <label className={labelClass}>Image URL</label>
                  <input
                    className={inputClass}
                    value={form.imageUrl}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, imageUrl: e.target.value }))
                    }
                  />
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
                  <label className={labelClass}>Directions</label>
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={form.directions}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, directions: e.target.value }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Opening hours</label>
                  <input
                    className={inputClass}
                    value={form.openingHours}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, openingHours: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
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
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
