/** Auto SKU generation for merch variants: NAME-COLOR-SIZE, e.g.
 * STUDIO-HOODIE-BLACK-M. Pure helpers so client + server share behavior. */

export function slugToken(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function buildSku(
  productName: string,
  size?: string | null,
  color?: string | null
): string {
  const parts = [productName, color, size]
    .map((p) => slugToken((p || "").trim()))
    .filter(Boolean);
  if (parts.length === 0) return "";
  return parts.join("-").slice(0, 80);
}

export function withSuffix(sku: string, attempt: number): string {
  if (attempt <= 0) return sku;
  const suffix = `-${attempt + 1}`;
  return `${sku.slice(0, 80 - suffix.length)}${suffix}`;
}
