import React, { useRef, useState } from "react";
import { normalizeMediaUrl } from "@/lib/media-url";
import { Button, Field, TextField } from "@/components/ui";

/**
 * Shared media source field: upload from this device (stored via
 * /api/upload/image on Cloudinary) OR paste an external link (Cloudinary URL,
 * Google Drive / Dropbox share links are normalized to direct links). Shows a
 * preview once a value is set. Composes the shared UI primitives so it matches
 * the rest of the CRM.
 */
export default function MediaUrlField({
  label,
  value,
  onChange,
  accept = "image/*",
  hint,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  hint?: string;
  wide?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload/image", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Upload failed");
      onChange(json.imageUrl as string);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const useLink = () => {
    const { url, error: err } = normalizeMediaUrl(draft);
    if (err || !url) {
      setError(err || "Invalid link.");
      return;
    }
    setError(null);
    onChange(url);
    setDraft("");
  };

  return (
    <Field label={label} error={error}>
      {value ? (
        <div className={wide ? "mt-1 space-y-2" : "mt-1 flex items-start gap-3"}>
          <img
            src={value}
            alt=""
            className={
              wide
                ? "aspect-[16/10] w-full rounded-field border border-border object-cover"
                : "h-20 w-20 rounded-field border border-border object-cover"
            }
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-ink-500" title={value}>
              {value}
            </p>
            <Button
              variant="ghost"
              className="mt-1 px-0 text-red-600 hover:bg-transparent hover:text-red-700"
              onClick={() => {
                setError(null);
                onChange("");
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-1 space-y-2">
          <div>
            <Button
              variant="secondary"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload from this device"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
          </div>
          <div className="flex gap-2">
            <TextField
              type="url"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  useLink();
                }
              }}
              placeholder="…or paste an image link (Drive, Dropbox, URL)"
            />
            <Button variant="secondary" onClick={useLink} className="shrink-0">
              Use link
            </Button>
          </div>
          <p className="text-xs text-ink-400">
            {hint ||
              "JPEG, PNG, WebP or GIF, max 10MB. Drive and Dropbox share links are converted automatically."}
          </p>
        </div>
      )}
    </Field>
  );
}
