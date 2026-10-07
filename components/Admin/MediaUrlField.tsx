import React, { useRef, useState } from "react";
import { normalizeMediaUrl } from "@/lib/media-url";

/**
 * Shared media source field: upload a file from the local machine (stored
 * via /api/upload/image on Cloudinary) OR paste an external link
 * (Cloudinary URL, Google Drive / Dropbox share links are normalized to
 * direct links). Shows a preview once a value is set.
 */
export default function MediaUrlField({
  label,
  value,
  onChange,
  accept = "image/*",
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  hint?: string;
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
      const res = await fetch("/api/upload/image", {
        method: "POST",
        body,
      });
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
    <div>
      <span className="block text-xs font-medium uppercase tracking-wide text-ink-500">
        {label}
      </span>
      {value ? (
        <div className="mt-2 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="h-20 w-20 border border-gray-200 object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-gray-500" title={value}>
              {value}
            </p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                onChange("");
              }}
              className="mt-1 text-xs text-red-600 hover:text-red-900"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <div>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="border border-gray-300 px-3 py-2 text-sm text-black hover:border-black disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload from this device"}
            </button>
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
            <input
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
              className="w-full border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:border-black"
            />
            <button
              type="button"
              onClick={useLink}
              className="shrink-0 border border-gray-300 px-3 py-2 text-sm text-black hover:border-black"
            >
              Use link
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {hint ||
              "JPEG, PNG, WebP or GIF, max 10MB. Drive and Dropbox share links are converted automatically."}
          </p>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
