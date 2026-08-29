import { useEffect, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { Plus, Edit3, Trash2, X, Upload } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ComingSoon";

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
  coverImage: string | null;
  artistName: string;
  releaseType: string;
  genre: string | null;
  publishStatus: string;
  playCount: number;
  unlockCount: number;
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
  coverImage: string;
  artistName: string;
  releaseType: string;
  genre: string;
  publishStatus: string;
  accessMode: string;
  price: string;
  paidPlayLimit: string;
};

const emptyForm = (): ReleaseForm => ({
  title: "",
  slug: "",
  description: "",
  coverImage: "",
  artistName: "Jojjy Gallery",
  releaseType: "SINGLE",
  genre: "",
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

const inputClass =
  "mt-1 w-full border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-950";
const labelClass =
  "block text-xs font-medium uppercase tracking-wide text-ink-500";

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
  const [editing, setEditing] = useState<ReleaseRow | null>(null);
  const [form, setForm] = useState<ReleaseForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [trackTitle, setTrackTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  const [grantEmail, setGrantEmail] = useState("");
  const [grantReleaseId, setGrantReleaseId] = useState("");
  const [grantPlanId, setGrantPlanId] = useState("");
  const [grantMsg, setGrantMsg] = useState<string | null>(null);

  const [planForm, setPlanForm] = useState({
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
        coverImage: editing.coverImage || "",
        artistName: editing.artistName,
        releaseType: editing.releaseType,
        genre: editing.genre || "",
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

  const saveRelease = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: form.title,
        slug: form.slug || undefined,
        description: form.description || null,
        coverImage: form.coverImage || null,
        artistName: form.artistName,
        releaseType: form.releaseType,
        genre: form.genre || null,
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
      if (!editing) {
        setEditing(json.data);
      } else {
        setEditing(json.data);
      }
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

  const uploadCover = async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/upload/image", { method: "POST", body });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Cover upload failed");
    setForm((f) => ({ ...f, coverImage: json.imageUrl }));
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
    setGrantMsg(null);
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
    setGrantMsg(json.message || (res.ok ? "Granted" : "Failed"));
    if (res.ok) mutate();
  };

  const createPlan = async () => {
    const res = await fetch("/api/music/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planForm),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.message || "Failed");
      return;
    }
    mutatePlans();
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Music · CRM</title>
      </Head>
      <div className="p-8 max-w-6xl">
        <PageHeader
          title="Music"
          description="Releases, Studio Pass plans, and manual access grants."
        >
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 bg-ink-950 text-white px-4 py-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              New release
            </button>
        </PageHeader>

        {error && (
          <p className="mt-4 text-sm text-red-700">{(error as Error).message}</p>
        )}
        {isLoading && <p className="mt-6 text-sm text-ink-500">Loading…</p>}

        <div className="mt-6 overflow-x-auto border border-ink-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Tracks</th>
                <th className="px-4 py-3">Plays</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(releases || []).map((r) => (
                <tr key={r.id} className="border-b border-ink-100">
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3">{r.publishStatus}</td>
                  <td className="px-4 py-3">
                    {r.accessPolicy?.accessMode}
                    {r.accessPolicy?.accessMode === "PAID" &&
                      r.accessPolicy.price != null &&
                      ` · ${r.accessPolicy.price} ${r.accessPolicy.currency}`}
                  </td>
                  <td className="px-4 py-3">{r.tracks.length}</td>
                  <td className="px-4 py-3">{r.playCount}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="inline-flex p-1.5 text-ink-600 hover:text-ink-950"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRelease(r.id)}
                      className="inline-flex p-1.5 text-ink-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {releases?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-ink-500">
                    No releases yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <section className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="border border-ink-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Studio Pass plans
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(plans || []).map((p) => (
                <li key={p.id} className="flex justify-between border-b border-ink-100 py-2">
                  <span>
                    {p.name} · {p.durationDays}d
                  </span>
                  <span>
                    {p.price} {p.currency}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2">
              <input
                className={inputClass}
                placeholder="Plan name"
                value={planForm.name}
                onChange={(e) =>
                  setPlanForm((f) => ({ ...f, name: e.target.value }))
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputClass}
                  placeholder="Price KES"
                  value={planForm.price}
                  onChange={(e) =>
                    setPlanForm((f) => ({ ...f, price: e.target.value }))
                  }
                />
                <input
                  className={inputClass}
                  placeholder="Days"
                  value={planForm.durationDays}
                  onChange={(e) =>
                    setPlanForm((f) => ({ ...f, durationDays: e.target.value }))
                  }
                />
              </div>
              <button
                type="button"
                onClick={createPlan}
                className="bg-ink-950 px-3 py-2 text-sm text-white"
              >
                Add plan
              </button>
            </div>
          </div>

          <div className="border border-ink-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Manual grants
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              MVP commerce until Order fulfillment is live.
            </p>
            <div className="mt-3 space-y-2">
              <input
                className={inputClass}
                placeholder="Fan email"
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
              />
              <select
                className={inputClass}
                value={grantReleaseId}
                onChange={(e) => setGrantReleaseId(e.target.value)}
              >
                <option value="">Release for unlock…</option>
                {(releases || []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={grantPlanId}
                onChange={(e) => setGrantPlanId(e.target.value)}
              >
                <option value="">Membership plan…</option>
                {(plans || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => runGrant("unlock")}
                  className="bg-ink-950 px-3 py-2 text-sm text-white"
                >
                  Grant unlock
                </button>
                <button
                  type="button"
                  onClick={() => runGrant("membership")}
                  className="border border-ink-950 px-3 py-2 text-sm"
                >
                  Grant pass
                </button>
              </div>
              {grantMsg && (
                <p className="text-sm text-ink-700">{grantMsg}</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="mt-8 w-full max-w-xl border border-ink-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
              <h2 className="font-semibold">
                {editing ? "Edit release" : "New release"}
              </h2>
              <button type="button" onClick={close}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              {formError && (
                <p className="text-sm text-red-700">{formError}</p>
              )}
              <label className={labelClass}>
                Title
                <input
                  className={inputClass}
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </label>
              <label className={labelClass}>
                Slug
                <input
                  className={inputClass}
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: e.target.value }))
                  }
                />
              </label>
              <label className={labelClass}>
                Description
                <textarea
                  className={inputClass}
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>
                  Type
                  <select
                    className={inputClass}
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
                  </select>
                </label>
                <label className={labelClass}>
                  Status
                  <select
                    className={inputClass}
                    value={form.publishStatus}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        publishStatus: e.target.value,
                      }))
                    }
                  >
                    {["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].map(
                      (t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>
                  Access
                  <select
                    className={inputClass}
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
                  </select>
                </label>
                <label className={labelClass}>
                  Price (KES)
                  <input
                    className={inputClass}
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                  />
                </label>
              </div>
              <label className={labelClass}>
                Cover image URL
                <div className="mt-1 flex gap-2">
                  <input
                    className={inputClass + " !mt-0"}
                    value={form.coverImage}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, coverImage: e.target.value }))
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
                        try {
                          await uploadCover(file);
                        } catch (err) {
                          setFormError((err as Error).message);
                        }
                      }}
                    />
                  </label>
                </div>
              </label>

              {editing && (
                <div className="border-t border-ink-100 pt-3">
                  <p className={labelClass}>Tracks</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {editing.tracks.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between"
                      >
                        <span>
                          {t.trackNumber}. {t.title}
                        </span>
                        <button
                          type="button"
                          className="text-red-700"
                          onClick={() => deleteTrack(t.id)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <input
                      className={inputClass + " !mt-0"}
                      placeholder="Track title"
                      value={trackTitle}
                      onChange={(e) => setTrackTitle(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={addTrack}
                      className="shrink-0 bg-ink-950 px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      {uploading ? "Uploading…" : "Upload audio"}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-ink-200 px-5 py-4">
              <button type="button" onClick={close} className="px-4 py-2 text-sm">
                Close
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveRelease}
                className="bg-ink-950 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
