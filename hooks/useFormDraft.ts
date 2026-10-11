import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearDraft as removeDraft,
  isDirty,
  readDraft,
  stripKeys,
  writeDraft,
} from "@/lib/form-draft";

export interface UseFormDraftOptions<T> {
  /** Stable namespaced key, e.g. `jenga:crm:draft:event:new`. Null disables. */
  draftKey: string | null;
  /** Current live form values (persisted, debounced). */
  values: T;
  /** Pristine shape; drafts equal to it are never written. */
  emptyValues: T;
  /** Keys holding File/Blob objects — stripped before persist/compare. */
  fileKeys?: string[];
  /** Apply a restored draft to the form. */
  onRestore: (values: T) => void;
  /** Persist only while true (e.g. modal open). */
  enabled?: boolean;
  /** Set false when the host restores via peekDraft() itself. */
  autoRestore?: boolean;
  debounceMs?: number;
}

export interface UseFormDraftResult {
  /** A draft was recovered into the form on open. */
  recovered: boolean;
  /** Last successful local save time (for a quiet "Draft saved locally" note). */
  savedAt: Date | null;
  /** Remove the draft (call only after the server confirms success). */
  clear: () => void;
  /** Remove the draft and hide the recovered note. */
  discard: () => void;
}

/**
 * Local draft persistence for one authoring form. See lib/form-draft.ts.
 *
 * Restore runs when `draftKey` changes (new vs edit id): the stored draft is
 * applied via `onRestore` AFTER the caller has populated server values, so
 * callers must invoke this hook after their populate effect in render order
 * — or, more robustly, populate-then-restore inside a single effect using
 * `peekDraft`. This hook owns persistence + clearing only.
 */
export function useFormDraft<T>({
  draftKey,
  values,
  emptyValues,
  fileKeys = [],
  onRestore,
  enabled = true,
  autoRestore = true,
  debounceMs = 750,
}: UseFormDraftOptions<T>): UseFormDraftResult {
  const [recovered, setRecovered] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const keyRef = useRef<string | null>(null);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  // Restore once per key. Runs in render order relative to the host form's
  // own populate effect — hosts with async server data must populate first
  // (declare their effect before calling this hook is NOT sufficient; see
  // peekDraft for the deterministic pattern used below).
  useEffect(() => {
    setRecovered(false);
    if (!draftKey || !enabled || !autoRestore) {
      keyRef.current = draftKey;
      return;
    }
    keyRef.current = draftKey;
    const draft = readDraft<T>(draftKey);
    if (draft) {
      onRestoreRef.current(draft);
      setRecovered(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, enabled]);

  // Debounced persist. Writes only dirty (vs empty) sanitized snapshots;
  // reverts to removing the draft when the form returns to pristine.
  useEffect(() => {
    if (!draftKey || !enabled) return;
    const clean = stripKeys(
      values as Record<string, unknown>,
      fileKeys
    );
    const pristine = stripKeys(
      emptyValues as Record<string, unknown>,
      fileKeys
    );
    if (!isDirty(clean, pristine)) {
      removeDraft(draftKey);
      return;
    }
    const timer = setTimeout(() => {
      if (writeDraft(draftKey, clean)) setSavedAt(new Date());
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [draftKey, enabled, values, emptyValues, fileKeys, debounceMs]);

  const clear = useCallback(() => {
    if (keyRef.current) removeDraft(keyRef.current);
    setRecovered(false);
    setSavedAt(null);
  }, []);

  const discard = useCallback(() => {
    if (keyRef.current) removeDraft(keyRef.current);
    setRecovered(false);
  }, []);

  return { recovered, savedAt, clear, discard };
}

/** Synchronous draft read for populate-then-restore inside one host effect. */
export function peekDraft<T>(draftKey: string | null): T | null {
  if (!draftKey) return null;
  return readDraft<T>(draftKey);
}
