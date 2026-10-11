import React, { useState, useEffect } from "react";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  Table,
  Td,
  TextArea,
  TextField,
  Th,
} from "@/components/ui";
import { Plus, Edit3, Trash2 } from "lucide-react";
import useSWR from "swr";
import { APIError } from "@/types/api";
import { Series } from "@prisma/client";
import { useResumeAction } from "@/hooks/useResumeAction";
import { useFormDraft } from "@/hooks/useFormDraft";

interface SeriesFormData {
  id?: number;
  name: string;
  slug: string;
  description: string;
  introduction: string;
  artistStatement: string;
  filmUrl: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to fetch data");
  }
  return res.json();
};

const SeriesManagement = () => {
  const {
    data: seriesList,
    error,
    isLoading,
    mutate,
  } = useSWR<Series[]>("/api/series", fetcher);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const emptyForm = (): SeriesFormData => ({
    name: "",
    slug: "",
    description: "",
    introduction: "",
    artistStatement: "",
    filmUrl: "",
  });

  const [formData, setFormData] = useState<SeriesFormData>(emptyForm());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingSeries) {
      setFormData({
        id: editingSeries.id,
        name: editingSeries.name,
        slug: editingSeries.slug,
        description: editingSeries.description || "",
        introduction: editingSeries.introduction || "",
        artistStatement: editingSeries.artistStatement || "",
        filmUrl: editingSeries.filmUrl || "",
      });
    } else {
      setFormData(emptyForm());
    }
  }, [editingSeries, isModalOpen]);

  // Local draft persistence. Declared after the populate effect so a
  // restored draft applies on top of server values, never underneath.
  const seriesDraftKey = isModalOpen
    ? editingSeries
      ? `jenga:crm:draft:series:${editingSeries.id}`
      : "jenga:crm:draft:series:new"
    : null;
  const seriesDraft = useFormDraft({
    draftKey: seriesDraftKey,
    values: formData,
    emptyValues: emptyForm(),
    onRestore: (v) => setFormData(v),
    enabled: isModalOpen,
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    const newSlug = newName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-*|-*$/g, "");
    setFormData((prev) => ({ ...prev, name: newName, slug: newSlug }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  useResumeAction({
    domain: "series",
    rows: seriesList,
    onNew: () => handleAddSeries(),
    onEdit: (row) => handleEditSeries(row),
  });

  const handleAddSeries = () => {
    setEditingSeries(null);
    setSubmitError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  };

  const handleEditSeries = (series: Series) => {
    setEditingSeries(series);
    setSubmitError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSeries(null);
    setSubmitError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const method = editingSeries ? "PUT" : "POST";
    const url = "/api/series";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data: APIError | Series = await res.json();

      if (!res.ok) {
        setSubmitError(
          (data as APIError).message || "An unknown error occurred."
        );
        return;
      }

      setSuccessMessage(
        editingSeries
          ? "Series updated successfully!"
          : "Series added successfully!"
      );
      mutate(); // Revalidate SWR cache to update the list
      seriesDraft.clear();
      setTimeout(() => closeModal(), 1500);
    } catch (err: any) {
      console.error("Failed to save series:", err);
      setSubmitError(err.message || "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSeries = async (id: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this series? This cannot be undone."
      )
    ) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/series?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        setSubmitError(errorData.message || "Failed to delete series.");
        return;
      }

      setSuccessMessage("Series deleted successfully!");
      mutate(
        seriesList?.filter((s) => s.id !== id),
        false
      );
      mutate();
    } catch (err: any) {
      console.error("Failed to delete series:", err);
      setSubmitError(err.message || "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading series…" />;
  if (error) return <ErrorState message={error.message} />;

  return (
    <div>
      <PageHeader
        title="Manage Series"
        subtitle="Collections that group artworks for the public exhibition pages."
        actions={
          <Button onClick={handleAddSeries}>
            <Plus className="h-4 w-4" /> Add New Series
          </Button>
        }
      />

      {seriesList && seriesList.length === 0 ? (
        <EmptyState
          title="No series found"
          description="Add your first series to group artworks."
          action={<Button onClick={handleAddSeries}>Add New Series</Button>}
        />
      ) : (
        <Table
          head={
            <>
              <Th>Name</Th>
              <Th>Description</Th>
              <Th>Slug</Th>
              <Th>Created</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {seriesList?.map((series) => (
            <tr key={series.id}>
              <Td className="font-medium text-ink-900">{series.name}</Td>
              <Td className="max-w-xs text-ink-500">
                <div className="truncate" title={series.description || ""}>
                  {series.description || "-"}
                </div>
              </Td>
              <Td className="text-ink-500">{series.slug}</Td>
              <Td className="text-ink-500">
                {new Date(series.createdAt).toLocaleDateString()}
              </Td>
              <Td>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    className="px-2 py-1"
                    aria-label="Edit series"
                    onClick={() => handleEditSeries(series)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                    aria-label="Delete series"
                    onClick={() => handleDeleteSeries(series.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {/* Add/Edit Series Modal */}
      <Modal
          open={isModalOpen}
          title={editingSeries ? "Edit series" : "New series"}
          description={
            editingSeries
              ? "Update series details"
              : "Group artworks into a collection"
          }
          onClose={closeModal}
          editor
          wide
          footer={
            <>
              {submitError && (
                <span className="mr-auto text-sm text-red-600">{submitError}</span>
              )}
              {successMessage && (
                <span className="mr-auto text-sm text-green-700">
                  {successMessage}
                </span>
              )}
              {seriesDraft.savedAt && (
                <span className="mr-auto text-xs text-ink-400">
                  Draft saved locally
                </span>
              )}
              <Button
                variant="secondary"
                onClick={closeModal}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="series-form"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? editingSeries
                    ? "Updating…"
                    : "Adding…"
                  : editingSeries
                    ? "Update Series"
                    : "Add Series"}
              </Button>
            </>
          }
        >
          {seriesDraft.recovered && (
            <p className="text-xs text-ink-500">
              Draft recovered —{" "}
              <button
                type="button"
                onClick={() => {
                  seriesDraft.discard();
                  setFormData(
                    editingSeries
                      ? {
                          id: editingSeries.id,
                          name: editingSeries.name,
                          slug: editingSeries.slug,
                          description: editingSeries.description || "",
                          introduction: editingSeries.introduction || "",
                          artistStatement: editingSeries.artistStatement || "",
                          filmUrl: editingSeries.filmUrl || "",
                        }
                      : emptyForm()
                  );
                }}
                className="text-accent-700 underline-offset-2 hover:underline"
              >
                discard
              </button>
            </p>
          )}

          <form id="series-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <TextField
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleNameChange}
                  required
                />
              </Field>
              <Field label="Slug" hint="Auto-generated from the name.">
                <TextField
                  id="slug"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  readOnly
                  className="bg-ink-100"
                />
              </Field>
            </div>
            <Field label="Description">
              <TextArea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
              />
            </Field>
            <Field label="Introduction (exhibition page)">
              <TextArea
                id="introduction"
                name="introduction"
                value={formData.introduction}
                onChange={handleChange}
                rows={3}
              />
            </Field>
            <Field label="Artist statement">
              <TextArea
                id="artistStatement"
                name="artistStatement"
                value={formData.artistStatement}
                onChange={handleChange}
                rows={4}
              />
            </Field>
            <Field label="Film URL (YouTube / Vimeo)">
              <TextField
                type="url"
                id="filmUrl"
                name="filmUrl"
                value={formData.filmUrl}
                onChange={handleChange}
                placeholder="https://..."
              />
            </Field>
          </form>
        </Modal>
    </div>
  );
};

export default SeriesManagement;
