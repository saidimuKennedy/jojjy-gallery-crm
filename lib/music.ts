function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-*|-*$/g, "")
    .slice(0, 80);
}

export { slugify };

export function stackMembershipExpiry(
  currentExpiresAt: Date | null,
  durationDays: number,
  now = new Date()
): Date {
  const base =
    currentExpiresAt && currentExpiresAt > now ? currentExpiresAt : now;
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + durationDays);
  return next;
}
