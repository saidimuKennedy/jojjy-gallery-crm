/**
 * Resolve next publishedAt from create/update body.
 * - explicit publishedAt (ISO or null) wins when provided
 * - publish: true  → ensure published (keep existing or set now)
 * - publish: false → unpublish
 * - neither        → keep existing (null on create)
 */
export function resolvePublishedAt(
  body: { publish?: unknown; publishedAt?: unknown },
  existing: Date | null
): Date | null {
  if (body.publishedAt !== undefined) {
    return body.publishedAt ? new Date(String(body.publishedAt)) : null;
  }
  if (body.publish === true) {
    return existing ?? new Date();
  }
  if (body.publish === false) {
    return null;
  }
  return existing;
}
