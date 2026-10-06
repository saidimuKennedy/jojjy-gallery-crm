/** Shared merch variant validation for product POST/PUT. Returns the cleaned
 * variant rows or an error message (caller responds 400). */

export interface VariantInput {
  sku: string;
  size?: string | null;
  color?: string | null;
  price: number | string;
  stock?: number | string;
}

export interface CleanVariant {
  sku: string;
  size: string | null;
  color: string | null;
  price: number;
  stock: number;
}

export function validateVariants(
  variants: unknown
): { variants?: CleanVariant[]; error?: string } {
  if (!Array.isArray(variants)) return { variants: [] };
  const seen = new Set<string>();
  const cleaned: CleanVariant[] = [];
  for (const raw of variants) {
    const v = raw as VariantInput;
    const sku = typeof v.sku === "string" ? v.sku.trim() : "";
    if (!sku) return { error: "Every variant needs a non-empty sku." };
    if (seen.has(sku)) return { error: `Duplicate variant sku "${sku}".` };
    seen.add(sku);
    const price = typeof v.price === "number" ? v.price : parseFloat(String(v.price));
    if (!Number.isFinite(price) || price < 0) {
      return { error: `Variant "${sku}" needs a price of 0 or more.` };
    }
    const stock = v.stock === undefined || v.stock === null || v.stock === ""
      ? 0
      : Number(v.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      return { error: `Variant "${sku}" needs a whole-number stock of 0 or more.` };
    }
    cleaned.push({
      sku,
      size: v.size || null,
      color: v.color || null,
      price,
      stock,
    });
  }
  return { variants: cleaned };
}
