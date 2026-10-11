import { useEffect, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Edit3, ExternalLink, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Alert,
  Button,
  Card,
  CurrencyField,
  EmptyState,
  Field,
  LinkButton,
  LoadingState,
  Modal,
  PageHeader,
  SectionHeading,
  Select,
  StatusBadge,
  Table,
  Td,
  TextArea,
  TextField,
  Th,
} from "@/components/ui";
import MediaUrlField from "@/components/Admin/MediaUrlField";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useResumeAction } from "@/hooks/useResumeAction";
import { slugify } from "@/lib/music";

type TrackRow = {
  id: number;
  title: string;
  trackNumber: number;
  duration: number | null;
  hasAudio: boolean;
};

type ReleaseRow = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  artistNotes: string | null;
  studioNotes: string | null;
  coverImage: string | null;
  artistName: string;
  releaseType: string;
  genre: string | null;
  publishStatus: string;
  releaseDate: string | null;
  playCount: number;
  unlockCount: number;
  createdAt: string;
  accessPolicy: {
    accessMode: string;
    price: number | null;
    currency: string;
    paidPlayLimit: number;
  } | null;
  tracks: TrackRow[];
};

type PlanRow = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  durationDays: number;
  active: boolean;
};

type ReleaseForm = {
  title: string;
  slug: string;
  description: string;
  artistNotes: string;
  studioNotes: string;
  coverImage: string;
  artistName: string;
  releaseType: string;
  genre: string;
  releaseDate: string;
  publishStatus: string;
  accessMode: string;
  price: string;
  paidPlayLimit: string;
};

const emptyForm = (): ReleaseForm => ({
  title: "",
  slug: "",
  description: "",
  artistNotes: "",
  studioNotes: "",
  coverImage: "",
  artistName: "Jojjy Gallery",
  releaseType: "SINGLE",
  genre: "",
  releaseDate: "",
  publishStatus: "DRAFT",
  accessMode: "PAID",
  price: "",
  paidPlayLimit: "3",
});

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data;
};

function publishTone(status: string): "neutral" | "success" | "warning" | "info" {
  if (status === "PUBLISHED") return "success";
  if (status === "SCHEDULED") return "info";
  if (status === "ARCHIVED") return "warning";
  return "neutral";
}

// Public gallery base URL for "View public page" links. The gallery is a
// separate deployment; without this configured there is nowhere to link to,
// so the action is hidden rather than guessed.
const GALLERY_BASE_URL = (process.env.NEXT_PUBLIC_GALLERY_URL || "").replace(
  /\/+$/,
  ""
);

export default function MusicPage() {
  const {
    data: releases,
    error,
    isLoading,
    mutate,
  } = useSWR<ReleaseRow[]>("/api/music/releases", fetcher);
  const { data: plans, mutate: mutatePlans } = useSWR<PlanRow[]>(
    "/api/music/plans",
    fetcher
  );

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"releases" | "plans" | "grants">("releases");
  const [editing, setEditing] = useState<ReleaseRow | null>(null);
  const [form, setForm] = useState<ReleaseForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [trackTitle, setTrackTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  const [grantEmail, setGrantEmail] = useState("");
  const [grantReleaseId, setGrantReleaseId] = useState("");
  const [grantPlanId, setGrantPlanId] = useState("");

  const [planForm, setPlanForm] = useState({
    name: "Studio Pass",
    price: "1000",
    durationDays: "30",
    description: "",
  });
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  const resetPlanForm = () =>
    setPlanForm({
      name: "Studio Pass",
      price: "1000",
      durationDays: "30",
      description: "",
    });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.title,
        slug: editing.slug,
        description: editing.description || "",
        artistNotes: editing.artistNotes || "",
        studioNotes: editing.studioNotes || "",
        coverImage: editing.coverImage || "",
        artistName: editing.artistName,
        releaseType: editing.releaseType,
        genre: editing.genre || "",
        releaseDate: editing.releaseDate ? editing.releaseDate.slice(0, 10) : "",
        publishStatus: editing.publishStatus,
        accessMode: editing.accessPolicy?.accessMode || "PAID",
        price:
          editing.accessPolicy?.price != null
            ? String(editing.accessPolicy.price)
            : "",
        paidPlayLimit: String(editing.accessPolicy?.paidPlayLimit ?? 3),
      });
    } else {
      setForm(emptyForm());
    }
  }, [editing, open]);

  useResumeAction({
    domain: "release",
    rows: releases,
    onNew: () => openCreate(),
    onEdit: (row) => openEdit(row),
  });

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (row: ReleaseRow) => {
    setEditing(row);
    setFormError(null);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
    setFormError(null);
  };

  // Local draft persistence (after populate so restores win over server data).
  const releaseDraftKey = open
    ? editing
      ? `jenga:crm:draft:release:${editing.id}`
      : "jenga:crm:draft:release:new"
    : null;
  const releaseDraft = useFormDraft({
    draftKey: releaseDraftKey,
    values: form,
    emptyValues: emptyForm(),
    onRestore: (v) => setForm(v),
    enabled: open,
  });

  const saveRelease = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: form.title,
        slug: form.slug || undefined,
        description: form.description || null,
        artistNotes: form.artistNotes || null,
        studioNotes: form.studioNotes || null,
        coverImage: form.coverImage || null,
        artistName: form.artistName,
        releaseType: form.releaseType,
        genre: form.genre || null,
        releaseDate: form.releaseDate || null,
        publishStatus: form.publishStatus,
        accessMode: form.accessMode,
        price: form.price || null,
        paidPlayLimit: Number(form.paidPlayLimit) || 3,
      };
      const res = await fetch(
        editing ? `/api/music/releases/${editing.id}` : "/api/music/releases",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Save failed");
      await mutate();
      // Clear before switching keys: the modal stays open for tracks, and
      // the new edit-key must not inherit the just-saved new-draft.
      releaseDraft.clear();
      setEditing(json.data);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const removeRelease = async (id: number) => {
    if (!confirm("Delete this draft release?")) return;
    const res = await fetch(`/api/music/releases/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      alert(json.message || "Delete failed");
      return;
    }
    mutate();
  };

  const addTrack = async () => {
    if (!editing) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,.mp3,.wav,.flac";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      setFormError(null);
      try {
        const body = new FormData();
        body.append("file", file);
        const up = await fetch("/api/upload/audio", { method: "POST", body });
        const upJson = await up.json();
        if (!up.ok) throw new Error(upJson.message || "Audio upload failed");

        const res = await fetch(`/api/music/releases/${editing.id}/tracks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trackTitle || file.name.replace(/\.[^.]+$/, ""),
            storageKey: upJson.storageKey,
            duration: upJson.duration,
            fileSize: upJson.fileSize,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Track create failed");
        setTrackTitle("");
        const refreshed = await fetch(`/api/music/releases/${editing.id}`);
        const refreshedJson = await refreshed.json();
        setEditing(refreshedJson.data);
        mutate();
      } catch (e) {
        setFormError((e as Error).message);
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const deleteTrack = async (trackId: number) => {
    if (!editing) return;
    const res = await fetch(`/api/music/releases/${editing.id}/tracks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.message || "Failed");
      return;
    }
    const refreshed = await fetch(`/api/music/releases/${editing.id}`);
    const refreshedJson = await refreshed.json();
    setEditing(refreshedJson.data);
    mutate();
  };

  const runGrant = async (type: "unlock" | "membership") => {
    if (!grantEmail.trim()) {
      toast.error("Enter a fan email first");
      return;
    }
    if (type === "unlock" && !grantReleaseId) {
      toast.error("Choose a release to unlock");
      return;
    }
    if (type === "membership" && !grantPlanId) {
      toast.error("Choose a Studio Pass plan");
      return;
    }
    const res = await fetch("/api/music/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        userEmail: grantEmail,
        releaseId: grantReleaseId ? Number(grantReleaseId) : undefined,
        membershipPlanId: grantPlanId ? Number(grantPlanId) : undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.message || "Grant failed");
      return;
    }
    toast.success(json.message || "Granted");
    if (res.ok) mutate();
  };

  const createPlan = async () => {
    const isEdit = editingPlanId !== null;
    const res = await fetch("/api/music/plans", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isEdit ? { ...planForm, id: editingPlanId } : planForm
      ),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.message || "Could not save plan");
      return;
    }
    setEditingPlanId(null);
    resetPlanForm();
    setPlanModalOpen(false);
    mutatePlans();
    toast.success(isEdit ? "Plan updated" : "Plan added");
  };

  const startPlanEdit = (plan: PlanRow) => {
    setPlanForm({
      name: plan.name,
      price: String(plan.price),
      durationDays: String(plan.durationDays),
      description: plan.description ?? "",
    });
    setEditingPlanId(plan.id);
    setPlanModalOpen(true);
  };

  const openPlanCreate = () => {
    setEditingPlanId(null);
    resetPlanForm();
    setPlanModalOpen(true);
  };

  const cancelPlanEdit = () => {
    setEditingPlanId(null);
    resetPlanForm();
    setPlanModalOpen(false);
  };

  const deletePlan = async (id: number) => {
    if (!confirm("Delete this plan?")) return;
    const res = await fetch(`/api/music/plans?id=${id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.message || "Could not delete plan");
      return;
    }
    if (editingPlanId === id) cancelPlanEdit();
    mutatePlans();
    toast.success("Plan deleted");
  };

  const togglePlanActive = async (plan: PlanRow) => {
    const res = await fetch("/api/music/plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: plan.id, active: !plan.active }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.message || "Could not update plan");
      return;
    }
    mutatePlans();
    toast.success(plan.active ? "Plan deactivated" : "Plan reactivated");
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Music — Jojjy Gallery CRM</title>
      </Head>
      <PageHeader
        title="Music"
        subtitle="Releases, Studio Pass plans, and manual access grants."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New release
          </Button>
        }
      />

      <div
        role="tablist"
        aria-label="Music sections"
        className="mb-6 flex gap-6 border-b border-border"
      >
        {(
          [
            { key: "releases", label: "Releases" },
            { key: "plans", label: "Studio Pass plans" },
            { key: "grants", label: "Access grants" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 pb-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 ${
              tab === t.key
                ? "border-accent-600 font-medium text-ink-900"
                : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "releases" && (
        <>
      {error ? (
        <Alert tone="danger">{(error as Error).message}</Alert>
      ) : isLoading ? (
        <LoadingState label="Loading releases…" />
      ) : !releases?.length ? (
        <EmptyState
          title="No releases yet"
          description="Create your first release to start publishing music."
          action={<Button onClick={openCreate}>New release</Button>}
        />
      ) : (
        <Table
          head={
            <>
              <Th>Release</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Price</Th>
              <Th>Tracks</Th>
              <Th>Plays</Th>
              <Th>Created</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {releases.map((r) => (
            <tr key={r.id}>
              <Td>
                <div className="flex items-center gap-3">
                  {r.coverImage ? (
                    <img
                      src={r.coverImage}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-field border border-border object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field border border-border bg-ink-50 text-[10px] text-ink-400"
                    >
                      No art
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-900">
                      {r.title}
                    </span>
                    <span className="block truncate text-xs text-ink-500">
                      {r.artistName}
                    </span>
                  </span>
                </div>
              </Td>
              <Td className="whitespace-nowrap text-ink-600">
                {r.releaseType.replace(/_/g, " ")}
              </Td>
              <Td>
                <StatusBadge tone={publishTone(r.publishStatus)}>
                  {r.publishStatus}
                </StatusBadge>
              </Td>
              <Td className="whitespace-nowrap text-ink-600">
                {r.accessPolicy?.accessMode}
                {r.accessPolicy?.accessMode === "PAID" &&
                  r.accessPolicy.price != null &&
                  ` · ${r.accessPolicy.price} ${r.accessPolicy.currency}`}
              </Td>
              <Td className="text-ink-600">{r.tracks.length}</Td>
              <Td className="text-ink-600">{r.playCount}</Td>
              <Td className="whitespace-nowrap text-ink-600">
                {new Date(r.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Td>
              <Td>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    className="px-2 py-1"
                    onClick={() => openEdit(r)}
                    aria-label="Edit release"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  {GALLERY_BASE_URL && (
                    <LinkButton
                      href={`${GALLERY_BASE_URL}/music/${r.slug}`}
                      variant="ghost"
                      className="px-2 py-1"
                      aria-label={`View ${r.title} public page`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </LinkButton>
                  )}
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => removeRelease(r.id)}
                    aria-label="Delete release"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
        </>
      )}

      {tab === "plans" && (
      <section aria-label="Studio Pass plans" className="max-w-3xl">
        <Card>
          <SectionHeading
            action={
              <Button
                variant="ghost"
                className="px-2 py-1 text-xs"
                onClick={openPlanCreate}
              >
                + Add plan
              </Button>
            }
          >
            Studio Pass plans{editingPlanId !== null ? " · editing" : ""}
          </SectionHeading>
          <div className="max-h-64 overflow-y-auto">
          <ul className="divide-y divide-ink-100 text-sm">
            {(plans || []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 text-ink-800">
                  {p.name} · {p.durationDays}d
                  {!p.active && (
                    <StatusBadge tone="neutral">
                      <span className="ml-2">Inactive</span>
                    </StatusBadge>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="mr-1 text-ink-600">
                    {p.price} {p.currency}
                  </span>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => startPlanEdit(p)}
                    aria-label={`Edit plan ${p.name}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => togglePlanActive(p)}
                  >
                    {p.active ? "Deactivate" : "Reactivate"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => deletePlan(p.id)}
                    aria-label={`Delete plan ${p.name}`}
                  >
                    Delete
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          </div>
        </Card>
      </section>
      )}

      {tab === "grants" && (
      <section aria-label="Access grants" className="max-w-3xl">
        <Card>
          <SectionHeading>Manual grants</SectionHeading>
          <p className="-mt-2 mb-3 text-sm text-ink-600">
            Manual access for support cases — every grant is recorded against
            your staff account. Prefer checkout; use this when a fan
            can&apos;t pay online.
          </p>
          <div className="space-y-3">
            <Field label="Fan email" required>
              <TextField
                type="email"
                placeholder="fan@example.com"
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
              />
            </Field>
            <div className="space-y-2 rounded-field border border-border p-3">
              <p className="text-sm font-medium text-ink-800">
                Release unlock
              </p>
              {(releases || []).length > 0 ? (
                <>
                  <Select
                    aria-label="Release for unlock"
                    value={grantReleaseId}
                    onChange={(e) => setGrantReleaseId(e.target.value)}
                  >
                    <option value="">Release for unlock…</option>
                    {(releases || []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </Select>
                  <Button type="button" onClick={() => runGrant("unlock")}>
                    Grant unlock
                  </Button>
                </>
              ) : (
                <p className="text-xs text-ink-500">
                  No releases yet — create a release above to grant unlocks.
                </p>
              )}
            </div>
            <div className="space-y-2 rounded-field border border-border p-3">
              <p className="text-sm font-medium text-ink-800">Studio pass</p>
              {(plans || []).length > 0 ? (
                <>
                  <Select
                    aria-label="Membership plan"
                    value={grantPlanId}
                    onChange={(e) => setGrantPlanId(e.target.value)}
                  >
                    <option value="">Membership plan…</option>
                    {(plans || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => runGrant("membership")}
                  >
                    Grant pass
                  </Button>
                </>
              ) : (
                <p className="text-xs text-ink-500">
                  No plans yet — add a Studio Pass plan first.
                </p>
              )}
            </div>
          </div>
        </Card>
      </section>
      )}

      <Modal
        open={planModalOpen}
        title={editingPlanId !== null ? "Edit plan" : "New plan"}
        description="Studio Pass plans unlock member-only music."
        onClose={cancelPlanEdit}
        footer={
          <>
            <Button variant="secondary" onClick={cancelPlanEdit}>
              Cancel
            </Button>
            <Button type="button" onClick={createPlan}>
              {editingPlanId !== null ? "Update plan" : "Add plan"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Plan name" required>
            <TextField
              placeholder="Studio Pass"
              value={planForm.name}
              onChange={(e) =>
                setPlanForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (KES)">
              <CurrencyField
                value={planForm.price}
                onChange={(e) =>
                  setPlanForm((f) => ({ ...f, price: e.target.value }))
                }
              />
            </Field>
            <Field label="Duration (days)">
              <TextField
                type="number"
                min="1"
                step="1"
                value={planForm.durationDays}
                onChange={(e) =>
                  setPlanForm((f) => ({ ...f, durationDays: e.target.value }))
                }
              />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={open}
        title={editing ? "Edit release" : "New release"}
        description={
          editing
            ? "Update release details, access, and tracks"
            : "Create a release and its access policy"
        }
        onClose={close}
        editor
        wide
        footer={
          <>
            {releaseDraft.savedAt && (
              <span className="mr-auto text-xs text-ink-400">
                Draft saved locally
              </span>
            )}
            <Button variant="secondary" onClick={close}>
              Close
            </Button>
            <Button type="button" disabled={saving} onClick={saveRelease}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {releaseDraft.recovered && (
            <p className="text-xs text-ink-500">
              Draft recovered — your unfinished work was restored.{" "}
              <button
                type="button"
                onClick={() => {
                  releaseDraft.discard();
                  if (editing) openEdit({ ...editing });
                  else setForm(emptyForm());
                }}
                className="text-accent-700 underline-offset-2 hover:underline"
              >
                Discard draft
              </button>
            </p>
          )}
          {formError && (
            <Alert tone="danger" title="Could not save release">
              {formError}
            </Alert>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" required>
              <TextField
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    title: e.target.value,
                    // Slug tracks the title until the release exists; stored
                    // slugs are never rewritten on edit.
                    slug: editing ? f.slug : slugify(e.target.value),
                  }))
                }
                required
              />
            </Field>
            <MediaUrlField
              label="Cover image"
              wide
              value={form.coverImage}
              onChange={(url) => setForm((f) => ({ ...f, coverImage: url }))}
            />
          </div>
          <Field label="Artist name" required hint="Shown publicly under the release title.">
            <TextField
              value={form.artistName}
              onChange={(e) =>
                setForm((f) => ({ ...f, artistName: e.target.value }))
              }
              required
              placeholder="Njenga Ngugi"
            />
          </Field>
          <Field label="Description">
            <TextArea
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select
                value={form.releaseType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, releaseType: e.target.value }))
                }
              >
                {[
                  "SINGLE",
                  "EP",
                  "ALBUM",
                  "LIVE_SESSION",
                  "ACOUSTIC_SESSION",
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.publishStatus}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    publishStatus: e.target.value,
                  }))
                }
              >
                {["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Release date">
              <TextField
                type="date"
                value={form.releaseDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, releaseDate: e.target.value }))
                }
              />
            </Field>
            <Field label="Genre">
              <TextField
                value={form.genre}
                onChange={(e) =>
                  setForm((f) => ({ ...f, genre: e.target.value }))
                }
                placeholder="Ambient"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Access">
              <Select
                value={form.accessMode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, accessMode: e.target.value }))
                }
              >
                {["FREE", "PAID", "MEMBERS_ONLY"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            {form.accessMode === "PAID" && (
              <Field label="Price (KES)">
                <CurrencyField
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                />
              </Field>
            )}
          </div>
          <Field
            label="Preview play limit"
            hint="Free preview plays per listener before an unlock is required."
          >
            <TextField
              type="number"
              min="0"
              step="1"
              value={form.paidPlayLimit}
              onChange={(e) =>
                setForm((f) => ({ ...f, paidPlayLimit: e.target.value }))
              }
            />
          </Field>
          {editing && (
            <div className="border-t border-border pt-3">
              <SectionHeading>Tracks</SectionHeading>
              <ul className="space-y-1 text-sm">
                {editing.tracks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-ink-800">
                      {t.trackNumber}. {t.title}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="shrink-0 px-2 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => deleteTrack(t.id)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <TextField
                  aria-label="Track title"
                  placeholder="Track title"
                  value={trackTitle}
                  onChange={(e) => setTrackTitle(e.target.value)}
                />
                <Button
                  type="button"
                  disabled={uploading}
                  onClick={addTrack}
                  className="shrink-0"
                >
                  {uploading ? "Uploading…" : "Upload audio"}
                </Button>
              </div>
            </div>
          )}
          <Field label="Artist notes (public liner notes)">
            <TextArea
              rows={3}
              value={form.artistNotes}
              onChange={(e) =>
                setForm((f) => ({ ...f, artistNotes: e.target.value }))
              }
            />
          </Field>
          <Field label="Studio notes (members/owners only)">
            <TextArea
              rows={3}
              value={form.studioNotes}
              onChange={(e) =>
                setForm((f) => ({ ...f, studioNotes: e.target.value }))
              }
            />
          </Field>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
