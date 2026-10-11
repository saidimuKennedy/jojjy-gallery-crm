import { useEffect, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { Edit3, Plus, Trash2, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import MediaUrlField from "@/components/Admin/MediaUrlField";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useResumeAction } from "@/hooks/useResumeAction";
import { buildSku } from "@/lib/product-sku";
import {
  Button,
  CurrencyField,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  SectionHeading,
  Table,
  Td,
  TextArea,
  TextField,
  Th,
} from "@/components/ui";

type VariantForm = {
  sku: string;
  skuTouched: boolean;
  size: string;
  color: string;
  price: string;
  stock: string;
};

type ProductRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  isAvailable: boolean;
  variants: {
    id: number;
    sku: string;
    size: string | null;
    color: string | null;
    price: number;
    stock: number;
  }[];
};

type ProductForm = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  category: string;
  isAvailable: boolean;
  variants: VariantForm[];
};

type VariantFieldErrors = {
  size?: string;
  color?: string;
  price?: string;
  stock?: string;
};

type FormFieldErrors = {
  name?: string;
  variants: VariantFieldErrors[];
};

const emptyVariant = (): VariantForm => ({
  sku: "",
  skuTouched: false,
  size: "",
  color: "",
  price: "",
  stock: "0",
});

const emptyForm = (): ProductForm => ({
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  category: "",
  isAvailable: true,
  variants: [emptyVariant()],
});

const emptyFieldErrors = (): FormFieldErrors => ({ variants: [] });

const normalizeRestored = (v: ProductForm): ProductForm => ({
  ...emptyForm(),
  ...v,
  variants: (v.variants?.length ? v.variants : [emptyVariant()]).map((r) => ({
    ...emptyVariant(),
    ...r,
  })),
});

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data as ProductRow[];
};

export default function MerchPage() {
  const { data: products, error, isLoading, mutate } = useSWR(
    "/api/products",
    fetcher
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] =
    useState<FormFieldErrors>(emptyFieldErrors());

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        slug: editing.slug,
        description: editing.description || "",
        imageUrl: editing.imageUrl || "",
        category: editing.category || "",
        isAvailable: editing.isAvailable,
        variants: editing.variants.length
          ? editing.variants.map((v) => ({
              sku: v.sku,
              skuTouched: true,
              size: v.size || "",
              color: v.color || "",
              price: String(v.price),
              stock: String(v.stock),
            }))
          : [emptyVariant()],
      });
    } else {
      setForm(emptyForm());
    }
    setFieldErrors(emptyFieldErrors());
  }, [editing, open]);

  const merchDraft = useFormDraft<ProductForm>({
    draftKey: open
      ? editing
        ? `jenga:crm:draft:product:${editing.id}`
        : "jenga:crm:draft:product:new"
      : null,
    values: form,
    emptyValues: emptyForm(),
    onRestore: (v) => setForm(normalizeRestored(v)),
    enabled: open,
  });

  useResumeAction({
    domain: "product",
    rows: products,
    onNew: () => openCreate(),
    onEdit: (row) => openEdit(row),
  });

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFieldErrors(emptyFieldErrors());
    setOpen(true);
  };

  const openEdit = (product: ProductRow) => {
    setEditing(product);
    setFormError(null);
    setFieldErrors(emptyFieldErrors());
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
    setFormError(null);
    setFieldErrors(emptyFieldErrors());
  };

  const onNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-*|-$/g, "");
    setForm((prev) => ({
      ...prev,
      name,
      slug: editing ? prev.slug : slug,
      variants: editing
        ? prev.variants
        : prev.variants.map((v) =>
            v.skuTouched ? v : { ...v, sku: buildSku(name, v.size, v.color) }
          ),
    }));
    setFieldErrors((prev) => ({ ...prev, name: undefined }));
  };

  const updateVariant = (
    index: number,
    field: "size" | "color" | "price" | "stock",
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      ),
    }));
    setFieldErrors((prev) => ({
      ...prev,
      variants: prev.variants.map((e, i) =>
        i === index ? { ...e, [field]: undefined } : e
      ),
    }));
  };

  const addVariant = () => {
    setForm((p) => ({
      ...p,
      variants: [...p.variants, emptyVariant()],
    }));
  };

  const removeVariant = (index: number) => {
    setForm((p) => ({
      ...p,
      variants: p.variants.filter((_, j) => j !== index),
    }));
    setFieldErrors((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, j) => j !== index),
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const errors: FormFieldErrors = { variants: form.variants.map(() => ({})) };
    if (!form.name.trim()) errors.name = "Enter a product name.";

    const withSku = form.variants.map((v) => {
      // SKUs are fully automatic: regenerate every untouched row from the
      // current name/size/color; keep stored SKUs for existing products.
      const sku =
        v.skuTouched && v.sku.trim()
          ? v.sku.trim()
          : buildSku(form.name, v.size, v.color);
      return { ...v, sku };
    });

    // De-duplicate generated SKUs within this product so staff never see a
    // conflict they cannot fix (no SKU UI). Stored SKUs keep priority.
    const used = new Set<string>();
    withSku.forEach((v) => {
      if (v.skuTouched && v.sku) used.add(v.sku);
    });
    withSku.forEach((v) => {
      if (v.skuTouched || !v.sku) return;
      let candidate = v.sku;
      let n = 1;
      while (used.has(candidate)) {
        n += 1;
        candidate = `${v.sku.slice(0, 80 - `-${n}`.length)}-${n}`;
      }
      v.sku = candidate;
      used.add(candidate);
    });

    const rows = withSku.filter(
      (v) =>
        v.sku || v.size.trim() || v.color.trim() || v.price.trim() !== ""
    );
    if (rows.length === 0) {
      setSaving(false);
      setFormError("Add at least one variant with a price.");
      return;
    }

    const seen = new Set<string>();
    let blockingError: string | null = null;
    withSku.forEach((v) => {
      if (blockingError) return;
      const isEmpty =
        !v.sku && !v.size.trim() && !v.color.trim() && v.price.trim() === "";
      if (isEmpty) return;
      if (!v.sku) {
        blockingError =
          "A SKU could not be generated. Enter a product name plus a size or color for each variant.";
        return;
      }
      if (seen.has(v.sku)) {
        blockingError =
          `Two variants resolve to the same SKU "${v.sku}". Change a size or color so each combination is unique.`;
        return;
      }
      seen.add(v.sku);
    });
    withSku.forEach((v, i) => {
      const rowError = errors.variants[i];
      const isEmpty =
        !v.sku && !v.size.trim() && !v.color.trim() && v.price.trim() === "";
      if (isEmpty) return;
      const price = v.price.trim() === "" ? NaN : parseFloat(v.price);
      if (!Number.isFinite(price) || price < 0)
        rowError.price = "Enter a price of 0 or more.";
      const stock = v.stock.trim() === "" ? 0 : Number(v.stock);
      if (!Number.isInteger(stock) || stock < 0)
        rowError.stock = "Enter a whole-number stock of 0 or more.";
    });

    const hasErrors =
      errors.name ||
      errors.variants.some((r) => Object.values(r).some(Boolean));
    if (blockingError) {
      setForm((prev) => ({
        ...prev,
        variants: prev.variants.map((v, i) => ({ ...v, sku: withSku[i].sku })),
      }));
      setFieldErrors(errors);
      setFormError(blockingError);
      setSaving(false);
      return;
    }
    if (hasErrors || !form.name.trim()) {
      setForm((prev) => ({
        ...prev,
        variants: prev.variants.map((v, i) => ({ ...v, sku: withSku[i].sku })),
      }));
      setFieldErrors(errors);
      setFormError("Fix the highlighted fields before saving.");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        description: form.description || null,
        imageUrl: form.imageUrl || null,
        category: form.category || null,
        isAvailable: form.isAvailable,
        variants: withSku
          .filter(
            (v) =>
              v.sku || v.size.trim() || v.color.trim() || v.price.trim() !== ""
          )
          .map((v) => ({
            sku: v.sku,
            skuAuto: !v.skuTouched,
            size: v.size.trim() || null,
            color: v.color.trim() || null,
            price: parseFloat(v.price),
            stock: parseInt(v.stock.trim() === "" ? "0" : v.stock, 10),
          })),
      };
      const res = await fetch(
        editing ? `/api/products/${editing.id}` : "/api/products",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Save failed");
      }
      await mutate();
      merchDraft.clear();
      close();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this product?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      alert(json.message || "Delete failed");
      return;
    }
    mutate();
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Merch — Jojjy Gallery CRM</title>
      </Head>
      <PageHeader
        title="Merch"
        subtitle="Products, variants, and inventory."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New product
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading products…" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : !products?.length ? (
        <EmptyState
          title="No products yet"
          description="Create your first product to start selling merch."
          action={<Button onClick={openCreate}>New product</Button>}
        />
      ) : (
        <Table
          head={
            <>
              <Th>Name</Th>
              <Th>Category</Th>
              <Th>Variants</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {products.map((p) => (
            <tr key={p.id}>
              <Td>
                <div className="font-medium text-ink-900">{p.name}</div>
                <div className="text-xs text-ink-400">{p.slug}</div>
              </Td>
              <Td className="text-ink-600">{p.category || "—"}</Td>
              <Td className="text-ink-600">
                {p.variants.length} · stock{" "}
                {p.variants.reduce((sum, v) => sum + v.stock, 0)}
              </Td>
              <Td>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    className="px-2 py-1"
                    onClick={() => openEdit(p)}
                    aria-label="Edit"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => remove(p.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={open}
        title={editing ? "Edit product" : "New product"}
        description={
          editing
            ? "Update product details and variants"
            : "Add a product and its variants"
        }
        onClose={close}
        editor
        wide
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" form="product-form" disabled={saving}>
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={submit} className="space-y-5">
          {merchDraft.recovered && (
            <p className="text-xs text-ink-500">
              Draft recovered — your unfinished work was restored.{" "}
              <button
                type="button"
                onClick={() => {
                  merchDraft.discard();
                  setFieldErrors(emptyFieldErrors());
                  if (editing) openEdit({ ...editing });
                  else setForm(emptyForm());
                }}
                className="text-accent-700 underline-offset-2 hover:underline"
              >
                Discard draft
              </button>
            </p>
          )}
          {formError && <ErrorBanner message={formError} />}

          <div>
            <SectionHeading>Product</SectionHeading>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="md:col-span-3">
                <Field label="Name" required error={fieldErrors.name}>
                  <TextField
                    value={form.name}
                    onChange={(e) => onNameChange(e.target.value)}
                    aria-label="Product name"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <MediaUrlField
                  label="Image"
                  wide
                  value={form.imageUrl}
                  onChange={(url) => setForm((p) => ({ ...p, imageUrl: url }))}
                />
              </div>
            </div>
            <div className="mt-4">
              <Field label="Category">
                <TextField
                  value={form.category}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, category: e.target.value }))
                  }
                  placeholder="e.g. Hoodies, Prints"
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Description">
                <TextArea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </Field>
            </div>
          </div>

          <div>
            <SectionHeading
              action={
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={addVariant}
                >
                  + Add variant
                </Button>
              }
            >
              Variants
            </SectionHeading>
            <p className="mb-3 text-xs text-ink-500">
              Each size/color combination has its own price and stock. SKUs
              are generated automatically.
            </p>
            <div className="space-y-3">
              {form.variants.map((v, i) => {
                const rowError = fieldErrors.variants[i] || {};
                const summary = [v.color.trim(), v.size.trim()]
                  .filter(Boolean)
                  .join(" / ");
                return (
                  <div
                    key={i}
                    className="rounded-field border border-border p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink-800">
                        Variant {i + 1}
                        {summary ? ` — ${summary}` : ""}
                      </p>
                      {form.variants.length > 1 && (
                        <Button
                          variant="ghost"
                          className="shrink-0 px-2 text-xs"
                          aria-label={`Remove variant ${i + 1}`}
                          onClick={() => removeVariant(i)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-4">
                      <Field error={rowError.size}>
                        <TextField
                          placeholder="Size"
                          aria-label={`Variant ${i + 1} size`}
                          value={v.size}
                          onChange={(e) =>
                            updateVariant(i, "size", e.target.value)
                          }
                        />
                      </Field>
                      <Field error={rowError.color}>
                        <TextField
                          placeholder="Color"
                          aria-label={`Variant ${i + 1} color`}
                          value={v.color}
                          onChange={(e) =>
                            updateVariant(i, "color", e.target.value)
                          }
                        />
                      </Field>
                      <Field error={rowError.price}>
                        <CurrencyField
                          placeholder="Price (USD)"
                          aria-label={`Variant ${i + 1} price`}
                          value={v.price}
                          onChange={(e) =>
                            updateVariant(i, "price", e.target.value)
                          }
                        />
                      </Field>
                      <Field error={rowError.stock}>
                        <TextField
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Stock"
                          aria-label={`Variant ${i + 1} stock`}
                          value={v.stock}
                          onChange={(e) =>
                            updateVariant(i, "stock", e.target.value)
                          }
                        />
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
            {form.variants.length > 0 && (
              <Button
                variant="ghost"
                className="mt-2 px-2 py-1 text-xs"
                onClick={addVariant}
              >
                + Add another size/color
              </Button>
            )}
          </div>

          <div>
            <SectionHeading>Shop availability</SectionHeading>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.isAvailable}
                onChange={(e) =>
                  setForm((p) => ({ ...p, isAvailable: e.target.checked }))
                }
                className="mt-1"
              />
              <span className="text-sm">
                <span className="font-medium text-ink-800">
                  Available in shop
                </span>
                <span className="block text-ink-500">
                  Uncheck to hide this product from the public shop without
                  deleting it.
                </span>
              </span>
            </label>
          </div>
          {merchDraft.savedAt && (
            <p className="text-right text-[11px] text-ink-400">
              Draft saved locally
            </p>
          )}
        </form>
      </Modal>
    </DashboardLayout>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-field border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}
