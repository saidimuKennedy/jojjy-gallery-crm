/**
 * Local form-draft persistence (owner content CRM).
 *
 * Unsubmitted authoring work is mirrored to browser localStorage (debounced,
 * ~750ms) and restored when the owner returns — across refresh, navigation,
 * tab closure, redeploys and frontend restarts. Never submits, never touches
 * the database, never publishes. The form's own Save/Create/Update action
 * stays authoritative; drafts clear only after the server confirms success.
 */

export const DRAFT_VERSION = 1;
/** Drafts older than this are discarded on read. */
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** All draft keys live under this prefix: jenga:crm:draft:<domain>:<id|new>. */
export const DRAFT_KEY_PREFIX = "jenga:crm:draft:";

export interface DraftEnvelope<T> {
  version: number;
  savedAt: string;
  values: T;
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function stableStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/** Read + validate a draft. Expired, versioned-out or malformed data is dropped. */
export function readDraft<T>(key: string, now = Date.now()): T | null {
  try {
    const store = storage();
    if (!store || !key) return null;
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftEnvelope<T>>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== DRAFT_VERSION ||
      typeof parsed.savedAt !== "string" ||
      !parsed.values ||
      typeof parsed.values !== "object"
    ) {
      store.removeItem(key);
      return null;
    }
    const savedAt = Date.parse(parsed.savedAt);
    if (Number.isNaN(savedAt) || now - savedAt > DRAFT_TTL_MS) {
      store.removeItem(key);
      return null;
    }
    return parsed.values as T;
  } catch {
    try {
      storage()?.removeItem(key);
    } catch {
      /* storage unusable — form must keep working */
    }
    return null;
  }
}

/** Persist a draft envelope. Never throws. */
export function writeDraft<T>(key: string, values: T, now = Date.now()): boolean {
  try {
    const store = storage();
    if (!store || !key) return false;
    const envelope: DraftEnvelope<T> = {
      version: DRAFT_VERSION,
      savedAt: new Date(now).toISOString(),
      values,
    };
    const raw = stableStringify(envelope);
    if (raw == null) return false;
    store.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

/** Remove a draft. Never throws. */
export function clearDraft(key: string): void {
  try {
    if (key) storage()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export interface DraftSummary {
  key: string;
  domain: string;
  record: string;
  title: string;
  savedAt: string;
}

function summaryTitle(values: unknown): string {
  if (values && typeof values === "object") {
    const v = values as Record<string, unknown>;
    for (const k of ["title", "name"]) {
      if (typeof v[k] === "string" && v[k].trim()) {
        return (v[k] as string).trim();
      }
    }
  }
  return "(untitled)";
}

/**
 * Enumerate genuine local drafts (newest first). Each entry is validated
 * through the same readDraft() path, so expired/malformed data never
 * surfaces. Read-only: never writes or deletes (expired entries are pruned
 * lazily by readDraft itself).
 */
export function listDrafts(now = Date.now()): DraftSummary[] {
  try {
    const store = storage();
    if (!store) return [];
    const out: DraftSummary[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key || !key.startsWith(DRAFT_KEY_PREFIX)) continue;
      const rest = key.slice(DRAFT_KEY_PREFIX.length);
      const sep = rest.indexOf(":");
      if (sep <= 0) continue;
      const values = readDraft<unknown>(key, now);
      if (!values) continue;
      const env = readEnvelopeMeta(key);
      out.push({
        key,
        domain: rest.slice(0, sep),
        record: rest.slice(sep + 1),
        title: summaryTitle(values),
        savedAt: env,
      });
    }
    out.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
    return out;
  } catch {
    return [];
  }
}

function readEnvelopeMeta(key: string): string {
  try {
    const raw = storage()?.getItem(key);
    if (!raw) return new Date(0).toISOString();
    const parsed = JSON.parse(raw) as Partial<DraftEnvelope<unknown>>;
    return typeof parsed.savedAt === "string"
      ? parsed.savedAt
      : new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

/** Stable dirty-check: true when values differ from the baseline shape. */
export function isDirty<T>(values: T, baseline: T): boolean {
  const a = stableStringify(values);
  const b = stableStringify(baseline);
  if (a == null || b == null) return true;
  return a !== b;
}

/** Strip named keys (File/Blob holders) so drafts stay JSON-serializable. */
export function stripKeys<T extends Record<string, unknown>>(
  values: T,
  keys: string[]
): T {
  if (!keys.length) return values;
  const copy = { ...values };
  for (const k of keys) {
    if (k in copy) (copy as Record<string, unknown>)[k] = null;
  }
  return copy;
}
