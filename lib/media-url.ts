/**
 * Normalize staff-pasted media URLs into directly renderable links.
 * Accepts local-upload results (Cloudinary), plain https image URLs, and
 * share links from common external sources (Google Drive, Dropbox),
 * converting the latter to their direct-download equivalents.
 * Returns { url } on success or { error } with a staff-readable message.
 */
export function normalizeMediaUrl(input: string): { url?: string; error?: string } {
  const raw = (input || "").trim();
  if (!raw) return { error: "Paste a link first." };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { error: "That is not a valid URL." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { error: "Links must start with http(s)." };
  }

  const host = parsed.hostname.toLowerCase();

  // Google Drive share links -> direct download.
  //   https://drive.google.com/file/d/<ID>/view?...  =>  uc?export=download&id=<ID>
  //   https://drive.google.com/open?id=<ID>           =>  same
  if (host === "drive.google.com" || host.endsWith(".drive.google.com")) {
    const m = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    const id = m?.[1] || parsed.searchParams.get("id");
    if (!id) {
      return {
        error: "Drive link not recognized. Open the file in Drive and copy its share link.",
      };
    }
    return { url: `https://drive.google.com/uc?export=download&id=${id}` };
  }

  // Dropbox share links -> force direct download.
  if (host === "dropbox.com" || host.endsWith(".dropbox.com")) {
    parsed.searchParams.set("dl", "1");
    return { url: parsed.toString() };
  }

  return { url: parsed.toString() };
}
