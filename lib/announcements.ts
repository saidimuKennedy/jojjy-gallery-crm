/**
 * Resolve next publishedAt from create/update body.
 * - publish: true  → ensure published (keep existing or set now)
 * - publish: false → unpublish
 * - publishedAt set → use explicit value (ISO or null)
 * - neither        → keep existing (null on create)
 */
export function resolvePublishedAt(
  body: { publish?: unknown; publishedAt?: unknown },
  existing: Date | null
): Date | null {
  if (body.publish === true) {
    return existing ?? new Date();
  }
  if (body.publish === false) {
    return null;
  }
  if (body.publishedAt !== undefined) {
    return body.publishedAt ? new Date(String(body.publishedAt)) : null;
  }
  return existing;
}
