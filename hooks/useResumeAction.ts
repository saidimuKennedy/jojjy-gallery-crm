import { useEffect, useRef } from "react";
import { useRouter } from "next/router";

/**
 * Deep-link support for Overview quick actions / Continue Working:
 * `/dashboard/<section>?resume=<domain>:<id|new>` auto-opens the matching
 * create/edit UI. Edit targets wait for list data; the param is stripped
 * (shallow) only after handling so refresh-then-data still resolves.
 */
export function useResumeAction<T extends { id: number | string }>(opts: {
  domain: string;
  rows: T[] | undefined;
  onNew: () => void;
  onEdit: (row: T) => void;
}): void {
  const { domain, rows, onNew, onEdit } = opts;
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !router.isReady) return;
    const raw = router.query.resume;
    const token = Array.isArray(raw) ? raw[0] : raw;
    if (!token || !token.startsWith(`${domain}:`)) return;
    const id = token.slice(domain.length + 1);
    if (id === "new") {
      done.current = true;
      onNew();
      void router.replace(router.pathname, undefined, { shallow: true });
      return;
    }
    const row = rows?.find((r) => String(r.id) === id);
    if (!row) return;
    done.current = true;
    onEdit(row);
    void router.replace(router.pathname, undefined, { shallow: true });
  });
}
