import { useEffect, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { Plus, Edit3, Trash2, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ComingSoon";

type VariantForm = {
  sku: string;
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
  variants: VariantForm[];
};

const emptyVariant = (): VariantForm => ({
  sku: "",
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
  variants: [emptyVariant()],
});

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data as ProductRow[];
};

const inputClass =
  "mt-1 w-full border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-950";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-ink-500";

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

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        slug: editing.slug,
        description: editing.description || "",
        imageUrl: editing.imageUrl || "",
        category: editing.category || "",
        variants: editing.variants.length
          ? editing.variants.map((v) => ({
              sku: v.sku,
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
  }, [editing, open]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (product: ProductRow) => {
    setEditing(product);
    setFormError(null);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
    setFormError(null);
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
    }));
  };

  const updateVariant = (
    index: number,
    field: keyof VariantForm,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      ),
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        description: form.description || null,
        imageUrl: form.imageUrl || null,
        category: form.category || null,
        variants: form.variants
          .filter((v) => v.sku && v.price !== "")
          .map((v) => ({
            sku: v.sku,
            size: v.size || null,
            color: v.color || null,
            price: parseFloat(v.price),
            stock: parseInt(v.stock || "0", 10),
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
      if (!res.ok) throw new Error(json.message || "Save failed");
      await mutate();
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
        description="Products, variants, and inventory."
      >
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-ink-950 px-4 py-2 text-sm text-white hover:bg-ink-800"
        >
          <Plus className="h-4 w-4" />
          New product
        </button>
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-ink-500">Loading products…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : !products?.length ? (
        <p className="text-sm text-ink-500">No products yet.</p>
      ) : (
        <div className="overflow-x-auto border border-ink-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Variants</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-ink-100">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-ink-500">{p.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{p.category || "—"}</td>
                  <td className="px-4 py-3 text-ink-700">
                    {p.variants.length} · stock{" "}
                    {p.variants.reduce((sum, v) => sum + v.stock, 0)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="p-1.5 text-ink-600 hover:text-ink-950"
                        aria-label="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="p-1.5 text-ink-600 hover:text-red-700"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/40 px-4 py-10">
          <div className="w-full max-w-2xl border border-ink-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
              <h2 className="text-lg font-semibold">
                {editing ? "Edit product" : "New product"}
              </h2>
              <button type="button" onClick={close} aria-label="Close">
                <X className="h-5 w-5 text-ink-500" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4 px-5 py-5">
              {formError && (
                <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Name</label>
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => onNameChange(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Slug</label>
                  <input
                    className={inputClass}
                    value={form.slug}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, slug: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Category</label>
                  <input
                    className={inputClass}
                    value={form.category}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, category: e.target.value }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Image URL</label>
                  <input
                    className={inputClass}
                    value={form.imageUrl}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, imageUrl: e.target.value }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Description</label>
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={form.description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, description: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Variants</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        variants: [...p.variants, emptyVariant()],
                      }))
                    }
                    className="text-xs text-ink-700 hover:text-ink-950"
                  >
                    + Add variant
                  </button>
                </div>
                <div className="space-y-3">
                  {form.variants.map((v, i) => (
                    <div
                      key={i}
                      className="grid gap-2 border border-ink-100 p-3 sm:grid-cols-5"
                    >
                      <input
                        className={inputClass}
                        placeholder="SKU"
                        value={v.sku}
                        onChange={(e) => updateVariant(i, "sku", e.target.value)}
                        required
                      />
                      <input
                        className={inputClass}
                        placeholder="Size"
                        value={v.size}
                        onChange={(e) =>
                          updateVariant(i, "size", e.target.value)
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Color"
                        value={v.color}
                        onChange={(e) =>
                          updateVariant(i, "color", e.target.value)
                        }
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={inputClass}
                        placeholder="Price"
                        value={v.price}
                        onChange={(e) =>
                          updateVariant(i, "price", e.target.value)
                        }
                        required
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          className={inputClass}
                          placeholder="Stock"
                          value={v.stock}
                          onChange={(e) =>
                            updateVariant(i, "stock", e.target.value)
                          }
                        />
                        {form.variants.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((p) => ({
                                ...p,
                                variants: p.variants.filter((_, j) => j !== i),
                              }))
                            }
                            className="mt-1 px-2 text-ink-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
                <button
                  type="button"
                  onClick={close}
                  className="px-4 py-2 text-sm text-ink-700 hover:text-ink-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-ink-950 px-4 py-2 text-sm text-white hover:bg-ink-800 disabled:opacity-50"
                >
                  {saving ? "Saving…" : editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
