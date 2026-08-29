import { useEffect, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { Plus, Edit3, Trash2, X, Megaphone, EyeOff } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ComingSoon";

type EventOption = { id: number; title: string };

type AnnouncementRow = {
  id: number;
  title: string;
  body: string;
  eventId: number | null;
  publishedAt: string | null;
  createdAt: string;
  event?: { id: number; title: string; slug: string } | null;
};

type FormState = {
  title: string;
  body: string;
  eventId: string;
};

const emptyForm = (): FormState => ({
  title: "",
  body: "",
  eventId: "",
});

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data;
};

const inputClass =
  "mt-1 w-full border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-950";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-ink-500";

export default function AnnouncementsPage() {
  const {
    data: announcements,
    error,
    isLoading,
    mutate,
  } = useSWR<AnnouncementRow[]>("/api/announcements", fetcher);
  const { data: events } = useSWR<EventOption[]>("/api/events", fetcher);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.title,
        body: editing.body,
        eventId: editing.eventId ? String(editing.eventId) : "",
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

  const openEdit = (row: AnnouncementRow) => {
    setEditing(row);
    setFormError(null);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const save = async (publish: boolean) => {
    setSaving(true);
    setFormError(null);
    try {
      // Omit publish on "Save" so an already-published row keeps publishedAt.
      // Only send publish: true when the Publish button is used.
      const payload: {
        title: string;
        body: string;
        eventId: string | null;
        publish?: boolean;
      } = {
        title: form.title,
        body: form.body,
        eventId: form.eventId || null,
      };
      if (publish) payload.publish = true;

      const res = await fetch(
        editing ? `/api/announcements/${editing.id}` : "/api/announcements",
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

  const publishExisting = async (row: AnnouncementRow) => {
    const res = await fetch(`/api/announcements/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: row.title,
        body: row.body,
        eventId: row.eventId,
        publish: true,
      }),
    });
    if (!res.ok) {
      const json = await res.json();
      alert(json.message || "Publish failed");
      return;
    }
    mutate();
  };

  const unpublishExisting = async (row: AnnouncementRow) => {
    const res = await fetch(`/api/announcements/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: row.title,
        body: row.body,
        eventId: row.eventId,
        publish: false,
      }),
    });
    if (!res.ok) {
      const json = await res.json();
      alert(json.message || "Unpublish failed");
      return;
    }
    mutate();
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this announcement?")) return;
    const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
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
        <title>Announcements — Jojjy Gallery CRM</title>
      </Head>
      <PageHeader
        title="Announcements"
        description="Fan updates via on-site, email, and WhatsApp."
      >
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-ink-950 px-4 py-2 text-sm text-white hover:bg-ink-800"
        >
          <Plus className="h-4 w-4" />
          New announcement
        </button>
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-ink-500">Loading announcements…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : !announcements?.length ? (
        <p className="text-sm text-ink-500">No announcements yet.</p>
      ) : (
        <div className="overflow-x-auto border border-ink-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map((row) => (
                <tr key={row.id} className="border-b border-ink-100">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.title}</div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-ink-500">
                      {row.body}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-700">
                    {row.event?.title || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.publishedAt ? (
                      <span className="text-xs uppercase tracking-wide text-ink-600">
                        Published{" "}
                        {new Date(row.publishedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-xs uppercase tracking-wide text-ink-400">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {!row.publishedAt ? (
                        <button
                          type="button"
                          onClick={() => publishExisting(row)}
                          className="p-1.5 text-ink-600 hover:text-ink-950"
                          title="Publish"
                          aria-label="Publish"
                        >
                          <Megaphone className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => unpublishExisting(row)}
                          className="p-1.5 text-ink-600 hover:text-ink-950"
                          title="Unpublish"
                          aria-label="Unpublish"
                        >
                          <EyeOff className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="p-1.5 text-ink-600 hover:text-ink-950"
                        aria-label="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(row.id)}
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
          <div className="w-full max-w-xl border border-ink-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
              <h2 className="text-lg font-semibold">
                {editing ? "Edit announcement" : "New announcement"}
              </h2>
              <button type="button" onClick={close} aria-label="Close">
                <X className="h-5 w-5 text-ink-500" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              {formError && (
                <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}
              <div>
                <label className={labelClass}>Title</label>
                <input
                  className={inputClass}
                  value={form.title}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, title: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Body</label>
                <textarea
                  className={inputClass}
                  rows={5}
                  value={form.body}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, body: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Event (optional)</label>
                <select
                  className={inputClass}
                  value={form.eventId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, eventId: e.target.value }))
                  }
                >
                  <option value="">None</option>
                  {(events || []).map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
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
                  type="button"
                  disabled={saving || !form.title || !form.body}
                  onClick={() => save(false)}
                  className={
                    editing?.publishedAt
                      ? "bg-ink-950 px-4 py-2 text-sm text-white hover:bg-ink-800 disabled:opacity-50"
                      : "border border-ink-300 px-4 py-2 text-sm text-ink-800 hover:bg-ink-50 disabled:opacity-50"
                  }
                >
                  {saving
                    ? "Saving…"
                    : editing?.publishedAt
                      ? "Save"
                      : "Save draft"}
                </button>
                {!editing?.publishedAt && (
                  <button
                    type="button"
                    disabled={saving || !form.title || !form.body}
                    onClick={() => save(true)}
                    className="bg-ink-950 px-4 py-2 text-sm text-white hover:bg-ink-800 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Publish"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
