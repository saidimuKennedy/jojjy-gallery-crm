import { useEffect, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { Edit3, EyeOff, Megaphone, Plus, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import MediaUrlField from "@/components/Admin/MediaUrlField";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useResumeAction } from "@/hooks/useResumeAction";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
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

type EventOption = { id: number; title: string };

type AnnouncementRow = {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  eventId: number | null;
  publishedAt: string | null;
  createdAt: string;
  event?: { id: number; title: string; slug: string } | null;
};

type FormState = {
  title: string;
  body: string;
  imageUrl: string;
  eventId: string;
};

const emptyForm = (): FormState => ({
  title: "",
  body: "",
  imageUrl: "",
  eventId: "",
});

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data;
};

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
        imageUrl: editing.imageUrl || "",
        eventId: editing.eventId ? String(editing.eventId) : "",
      });
    } else {
      setForm(emptyForm());
    }
  }, [editing, open]);

  const announcementDraft = useFormDraft<FormState>({
    draftKey: open
      ? editing
        ? `jenga:crm:draft:announcement:${editing.id}`
        : "jenga:crm:draft:announcement:new"
      : null,
    values: form,
    emptyValues: emptyForm(),
    onRestore: (v) => setForm({ ...emptyForm(), ...v }),
    enabled: open,
  });

  useResumeAction({
    domain: "announcement",
    rows: announcements,
    onNew: () => openCreate(),
    onEdit: (row) => openEdit(row),
  });

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
      const payload: {
        title: string;
        body: string;
        imageUrl: string | null;
        eventId: string | null;
        publish?: boolean;
      } = {
        title: form.title,
        body: form.body,
        imageUrl: form.imageUrl || null,
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
      announcementDraft.clear();
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
        subtitle="Fan updates published to the on-site feed."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New announcement
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading announcements…" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : !announcements?.length ? (
        <EmptyState
          title="No announcements yet"
          description="Write your first update for the public feed."
          action={<Button onClick={openCreate}>New announcement</Button>}
        />
      ) : (
        <Table
          head={
            <>
              <Th>Title</Th>
              <Th>Event</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {announcements.map((row) => (
            <tr key={row.id}>
              <Td>
                <div className="font-medium text-ink-900">{row.title}</div>
                <div className="mt-0.5 line-clamp-1 text-xs text-ink-500">
                  {row.body}
                </div>
              </Td>
              <Td className="text-ink-600">{row.event?.title || "—"}</Td>
              <Td>
                {row.publishedAt ? (
                  <StatusBadge tone="success">
                    Published {new Date(row.publishedAt).toLocaleDateString()}
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">Draft</StatusBadge>
                )}
              </Td>
              <Td>
                <div className="flex justify-end gap-1">
                  {!row.publishedAt ? (
                    <Button
                      variant="ghost"
                      className="px-2 py-1"
                      onClick={() => publishExisting(row)}
                      title="Publish"
                      aria-label="Publish"
                    >
                      <Megaphone className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      className="px-2 py-1"
                      onClick={() => unpublishExisting(row)}
                      title="Unpublish"
                      aria-label="Unpublish"
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="px-2 py-1"
                    onClick={() => openEdit(row)}
                    aria-label="Edit"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => remove(row.id)}
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

      <Modal
        open={open}
        title={editing ? "Edit announcement" : "New announcement"}
        description={
          editing
            ? "Update this update for the public feed"
            : "Write a new update for the public feed"
        }
        onClose={close}
        editor
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              variant={editing?.publishedAt ? "primary" : "secondary"}
              disabled={saving || !form.title || !form.body}
              onClick={() => save(false)}
            >
              {saving
                ? "Saving…"
                : editing?.publishedAt
                  ? "Save"
                  : "Save draft"}
            </Button>
            {!editing?.publishedAt && (
              <Button
                disabled={saving || !form.title || !form.body}
                onClick={() => save(true)}
              >
                {saving ? "Saving…" : "Publish"}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {announcementDraft.recovered && (
            <p className="text-xs text-ink-500">
              Draft recovered —{" "}
              <button
                type="button"
                onClick={() => {
                  announcementDraft.discard();
                  if (editing) openEdit({ ...editing });
                  else setForm(emptyForm());
                }}
                className="text-accent-700 underline-offset-2 hover:underline"
              >
                discard
              </button>
            </p>
          )}
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.9fr)] md:items-start">
            <Field label="Title" required>
              <TextField
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
                required
              />
            </Field>
            <MediaUrlField
              label="Cover image (optional)"
              value={form.imageUrl}
              onChange={(imageUrl) => setForm((p) => ({ ...p, imageUrl }))}
              wide
              hint="Shown beside this update in the gallery app. JPEG, PNG, WebP or GIF, max 10MB."
            />
          </div>
          <Field label="Body" required>
            <TextArea
              rows={5}
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              required
            />
          </Field>
          <Field label="Event (optional)">
            <Select
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
            </Select>
          </Field>
          {announcementDraft.savedAt && (
            <p className="text-right text-[11px] text-ink-400">
              Draft saved locally
            </p>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  );
}
