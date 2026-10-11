import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  SectionHeading,
  StatusBadge,
  Table,
  Td,
  TextArea,
  TextField,
  Th,
} from "@/components/ui";
import { Plus, Edit3, Trash2, X } from "lucide-react";
import useSWR from "swr";
import { APIError } from "@/types/api";
import { MediaBlogEntry, MediaBlogFile, MediaBlogEntryType, MediaFileType } from "@prisma/client";
import MediaUrlField from "@/components/Admin/MediaUrlField";
import { useResumeAction } from "@/hooks/useResumeAction";
import { useFormDraft } from "@/hooks/useFormDraft";

export type MediaBlogEntryWithRelations = MediaBlogEntry & {
  mediaFiles: MediaBlogFile[];
};

interface MediaBlogFileFormData {
  id?: number;
  url: string;
  type: MediaFileType;
  description: string;
  thumbnailUrl?: string;
  order: number;
}

interface MediaBlogEntryFormData {
  id?: number;
  title: string;
  shortDesc: string;
  type: MediaBlogEntryType;
  externalLink: string;
  thumbnailUrl: string;
  duration: string;
  content: string;
  // Staff-facing publication toggle. true = public (publishedAt set),
  // false = DRAFT (publishedAt null, never shown publicly).
  published: boolean;
  mediaFiles: MediaBlogFileFormData[];
}

const initialFormData: MediaBlogEntryFormData = {
  title: "",
  shortDesc: "",
  type: MediaBlogEntryType.BLOG_POST,
  externalLink: "",
  thumbnailUrl: "",
  duration: "",
  content: "",
  published: true,
  mediaFiles: [],
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to fetch data");
  }
  const data = await res.json();
  return data.data;
};

const MediaBlogManagement = () => {
  const {
    data: mediaBlogEntries,
    error,
    isLoading,
    mutate,
  } = useSWR<MediaBlogEntryWithRelations[]>("/api/media-blog", fetcher);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MediaBlogEntryWithRelations | null>(null);
  const [formData, setFormData] = useState<MediaBlogEntryFormData>(initialFormData);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingEntry) {
      setFormData({
        id: editingEntry.id,
        title: editingEntry.title,
        shortDesc: editingEntry.shortDesc || "",
        type: editingEntry.type,
        externalLink: editingEntry.externalLink || "",
        thumbnailUrl: editingEntry.thumbnailUrl || "",
        duration: editingEntry.duration || "",
        content: editingEntry.content || "",
        published: !!editingEntry.publishedAt,
        mediaFiles:
          editingEntry.mediaFiles?.map((mf) => ({
            id: mf.id,
            url: mf.url,
            type: mf.type,
            description: mf.description || "",
            thumbnailUrl: mf.thumbnailUrl || "",
            order: mf.order,
          })) || [],
      });
    } else {
      setFormData(initialFormData);
    }
  }, [editingEntry, isModalOpen]);

  // Local draft persistence (after populate so restores win over server data).
  const mediaBlogDraftKey = isModalOpen
    ? editingEntry
      ? `jenga:crm:draft:mediablog:${editingEntry.id}`
      : "jenga:crm:draft:mediablog:new"
    : null;
  const mediaBlogDraft = useFormDraft({
    draftKey: mediaBlogDraftKey,
    values: formData,
    emptyValues: initialFormData,
    onRestore: (v) => setFormData(v),
    enabled: isModalOpen,
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    },
    []
  );

  const handleMediaFileChange = useCallback(
    (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => {
        const newMediaFiles = [...prev.mediaFiles];
        if (name === "type") {
          newMediaFiles[index] = { ...newMediaFiles[index], [name]: value as MediaFileType };
        } else {
          newMediaFiles[index] = { ...newMediaFiles[index], [name]: value };
        }
        return { ...prev, mediaFiles: newMediaFiles };
      });
    },
    []
  );

  const addMediaFile = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      mediaFiles: [
        ...prev.mediaFiles,
        {
          url: "",
          type: MediaFileType.IMAGE,
          description: "",
          order: prev.mediaFiles.length + 1,
        },
      ],
    }));
  }, []);

  const removeMediaFile = useCallback((index: number) => {
    setFormData((prev) => {
      const newMediaFiles = prev.mediaFiles.filter((_, i) => i !== index);
      return {
        ...prev,
        mediaFiles: newMediaFiles.map((mf, i) => ({ ...mf, order: i + 1 })),
      };
    });
  }, []);

  useResumeAction({
    domain: "mediablog",
    rows: mediaBlogEntries,
    onNew: () => handleAddEntry(),
    onEdit: (row) => handleEditEntry(row),
  });

  const handleAddEntry = () => {
    setEditingEntry(null);
    setSubmitError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  };

  const handleEditEntry = (entry: MediaBlogEntryWithRelations) => {
    setEditingEntry(entry);
    setSubmitError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setSubmitError(null);
    setSuccessMessage(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    if (formData.mediaFiles.some((mf) => !mf.url.trim())) {
      setSubmitError("Every media file needs a file (upload or link).");
      return;
    }
    setIsSubmitting(true);

    const method = editingEntry ? "PUT" : "POST";
    const url = editingEntry ? `/api/media-blog/${editingEntry.id}` : "/api/media-blog";

    try {
      // Map the staff toggle to an explicit publishedAt: false (DRAFT) sends
      // null; true keeps the existing timestamp or publishes now.
      const payload = {
        ...formData,
        publishedAt: formData.published
          ? editingEntry?.publishedAt ?? new Date().toISOString()
          : null,
      };
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data: APIError | MediaBlogEntryWithRelations = await res.json();

      if (!res.ok) {
        setSubmitError(
          (data as APIError).message || "An unknown error occurred."
        );
        return;
      }

      setSuccessMessage(
        editingEntry
          ? "Media Blog Entry updated successfully!"
          : "Media Blog Entry added successfully!"
      );
      mutate();
      mediaBlogDraft.clear();
      setTimeout(() => closeModal(), 1500);
    } catch (err: any) {
      console.error("Failed to save media blog entry:", err);
      setSubmitError(err.message || "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this media blog entry? This cannot be undone."
      )
    ) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/media-blog/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        setSubmitError(errorData.message || "Failed to delete entry.");
        return;
      }

      setSuccessMessage("Media Blog Entry deleted successfully!");
      mutate(
        mediaBlogEntries?.filter((e) => e.id !== id),
        false
      );
      mutate();
    } catch (err: any) {
      console.error("Failed to delete entry:", err);
      setSubmitError(err.message || "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading media & blog…" />;
  if (error) return <ErrorState message={error.message} />;

  return (
    <div>
      <PageHeader
        title="Manage Media & Blog"
        subtitle="Videos, image sets, audio, and posts shown on the public updates page."
        actions={
          <Button onClick={handleAddEntry}>
            <Plus className="h-4 w-4" /> Add New Entry
          </Button>
        }
      />

      {mediaBlogEntries && mediaBlogEntries.length === 0 ? (
        <EmptyState
          title="No entries found"
          description="Add your first media or blog entry."
          action={<Button onClick={handleAddEntry}>Add New Entry</Button>}
        />
      ) : (
        <Table
          head={
            <>
              <Th>Title</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Short description</Th>
              <Th>Files</Th>
              <Th>Created</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {mediaBlogEntries?.map((entry) => (
            <tr key={entry.id}>
              <Td className="font-medium text-ink-900">{entry.title}</Td>
              <Td className="text-ink-500">{entry.type}</Td>
              <Td>
                <StatusBadge tone={entry.publishedAt ? "success" : "neutral"}>
                  {entry.publishedAt ? "Published" : "Draft"}
                </StatusBadge>
              </Td>
              <Td className="max-w-xs text-ink-500">
                <div className="truncate" title={entry.shortDesc || ""}>
                  {entry.shortDesc || "-"}
                </div>
              </Td>
              <Td className="text-ink-500">
                {entry.mediaFiles.length > 0 ? (
                  <StatusBadge tone="info">
                    {entry.mediaFiles.length} files
                  </StatusBadge>
                ) : (
                  "No files"
                )}
              </Td>
              <Td className="text-ink-500">
                {new Date(entry.createdAt).toLocaleDateString()}
              </Td>
              <Td>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    className="px-2 py-1"
                    aria-label="Edit entry"
                    onClick={() => handleEditEntry(entry)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                    aria-label="Delete entry"
                    onClick={() => handleDeleteEntry(entry.id)}
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
        open={isModalOpen}
        title={editingEntry ? "Edit media blog entry" : "New media blog entry"}
        description={
          editingEntry
            ? "Update entry details and media"
            : "Create a post, video, image set, or audio entry"
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
            {mediaBlogDraft.savedAt && (
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
            <Button type="submit" form="mediablog-form" disabled={isSubmitting}>
              {isSubmitting
                ? editingEntry
                  ? "Updating…"
                  : "Adding…"
                : editingEntry
                  ? "Update Entry"
                  : "Add Entry"}
            </Button>
          </>
        }
      >
        {mediaBlogDraft.recovered && (
          <p className="text-xs text-ink-500">
            Draft recovered —{" "}
            <button
              type="button"
              onClick={() => {
                mediaBlogDraft.discard();
                setFormData(
                  editingEntry
                    ? {
                        id: editingEntry.id,
                        title: editingEntry.title,
                        shortDesc: editingEntry.shortDesc || "",
                        type: editingEntry.type,
                        externalLink: editingEntry.externalLink || "",
                        thumbnailUrl: editingEntry.thumbnailUrl || "",
                        duration: editingEntry.duration || "",
                        content: editingEntry.content || "",
                        published: !!editingEntry.publishedAt,
                        mediaFiles:
                          editingEntry.mediaFiles?.map((mf) => ({
                            id: mf.id,
                            url: mf.url,
                            type: mf.type,
                            description: mf.description || "",
                            thumbnailUrl: mf.thumbnailUrl || "",
                            order: mf.order,
                          })) || [],
                      }
                    : initialFormData
                );
              }}
              className="text-accent-700 underline-offset-2 hover:underline"
            >
              discard
            </button>
          </p>
        )}

              <form id="mediablog-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-black mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      required
                      className="w-full border border-border px-3 py-2 text-black focus:outline-none focus:border-accent-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="type" className="block text-sm font-medium text-black mb-2">
                      Entry Type
                    </label>
                    <select
                      id="type"
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      required
                      className="w-full border border-border px-3 py-2 text-black focus:outline-none focus:border-accent-500 bg-white"
                    >
                      {Object.values(MediaBlogEntryType).map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-start gap-3 border border-border px-3 py-3">
                  <input
                    type="checkbox"
                    id="published"
                    name="published"
                    checked={formData.published}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        published: e.target.checked,
                      }))
                    }
                    className="mt-1"
                  />
                  <label htmlFor="published" className="text-sm text-black">
                    <span className="font-medium">Published</span>
                    <span className="block text-ink-500">
                      Uncheck to keep this entry as a private draft — drafts
                      never appear on the public site, homepage, or sitemap.
                    </span>
                  </label>
                </div>
                <div>
                  <label htmlFor="shortDesc" className="block text-sm font-medium text-black mb-2">
                    Short Description
                  </label>                  <textarea
                    id="shortDesc"
                    name="shortDesc"
                    value={formData.shortDesc}
                    onChange={handleChange}
                    rows={2}
                    className="w-full border border-border px-3 py-2 text-black focus:outline-none focus:border-accent-500"
                  ></textarea>
                </div>
                {formData.type === MediaBlogEntryType.EXTERNAL_LINK && (
                  <div>
                    <label htmlFor="externalLink" className="block text-sm font-medium text-black mb-2">
                      External Link URL
                    </label>
                    <input
                      type="url"
                      id="externalLink"
                      name="externalLink"
                      value={formData.externalLink}
                      onChange={handleChange}
                      className="w-full border border-border px-3 py-2 text-black focus:outline-none focus:border-accent-500"
                      placeholder="https://example.com/blog-post"
                    />
                  </div>
                )}
                 {(formData.type === MediaBlogEntryType.VIDEO || formData.type === MediaBlogEntryType.AUDIO) && (
                  <>
                    <div>
                      <MediaUrlField
                        label="Thumbnail (for video/audio cover)"
                        value={formData.thumbnailUrl}
                        onChange={(url) =>
                          setFormData((prev) => ({ ...prev, thumbnailUrl: url }))
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="duration" className="block text-sm font-medium text-black mb-2">
                        Duration (e.g., 05:30)
                      </label>
                      <input
                        type="text"
                        id="duration"
                        name="duration"
                        value={formData.duration}
                        onChange={handleChange}
                        className="w-full border border-border px-3 py-2 text-black focus:outline-none focus:border-accent-500"
                        placeholder="HH:MM:SS or MM:SS"
                      />
                    </div>
                  </>
                )}
                {formData.type === MediaBlogEntryType.BLOG_POST && (
                  <div>
                    <label htmlFor="content" className="block text-sm font-medium text-black mb-2">
                      Blog Content
                    </label>
                    <textarea
                      id="content"
                      name="content"
                      value={formData.content}
                      onChange={handleChange}
                      rows={8}
                      className="w-full border border-border px-3 py-2 text-black focus:outline-none focus:border-accent-500"
                    ></textarea>
                  </div>
                )}

                <h4 className="text-xl font-bold mt-6 mb-3 text-ink-800">Associated Media Files</h4>
                {formData.mediaFiles.length === 0 && (
                  <p className="text-ink-500">No media files added yet.</p>
                )}
                <div className="space-y-4">
                  {formData.mediaFiles.map((mediaFile, index) => (
                    <div key={mediaFile.id || `new-${index}`} className="border p-4 rounded-field bg-ink-50 relative">
                      <button
                        type="button"
                        onClick={() => removeMediaFile(index)}
                        aria-label="Remove media"
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <MediaUrlField
                          label="File URL"
                          value={mediaFile.url}
                          onChange={(url) =>
                            setFormData((prev) => {
                              const newMediaFiles = [...prev.mediaFiles];
                              newMediaFiles[index] = {
                                ...newMediaFiles[index],
                                url,
                              };
                              return { ...prev, mediaFiles: newMediaFiles };
                            })
                          }
                        />
                      </div>
                        <div>
                          <label htmlFor={`media-type-${index}`} className="block text-sm font-medium text-black mb-2">
                            File Type
                          </label>
                          <select
                            id={`media-type-${index}`}
                            name="type"
                            value={mediaFile.type}
                            onChange={(e) => handleMediaFileChange(index, e)}
                            required
                            className="w-full border border-border px-3 py-2 text-black focus:outline-none focus:border-accent-500 bg-white"
                          >
                            {Object.values(MediaFileType).map((type) => (
                              <option key={type} value={type}>
                                {type.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label htmlFor={`media-description-${index}`} className="block text-sm font-medium text-black mb-2">
                            Description
                          </label>
                          <textarea
                            id={`media-description-${index}`}
                            name="description"
                            value={mediaFile.description}
                            onChange={(e) => handleMediaFileChange(index, e)}
                            rows={2}
                            className="w-full border border-border px-3 py-2 text-black focus:outline-none focus:border-accent-500"
                          ></textarea>
                        </div>
                        {(mediaFile.type === MediaFileType.VIDEO || mediaFile.type === MediaFileType.AUDIO) && (
                          <div className="col-span-2">
                            <MediaUrlField
                              label="File thumbnail"
                              value={mediaFile.thumbnailUrl || ""}
                              onChange={(url) =>
                                setFormData((prev) => {
                                  const newMediaFiles = [...prev.mediaFiles];
                                  newMediaFiles[index] = {
                                    ...newMediaFiles[index],
                                    thumbnailUrl: url,
                                  };
                                  return { ...prev, mediaFiles: newMediaFiles };
                                })
                              }
                            />
                          </div>
                        )}
                        <div>
                          <label htmlFor={`media-order-${index}`} className="block text-sm font-medium text-black mb-2">
                            Order
                          </label>
                          <input
                            type="number"
                            id={`media-order-${index}`}
                            name="order"
                            value={mediaFile.order}
                            onChange={(e) => handleMediaFileChange(index, e)}
                            required
                            className="w-full border border-border px-3 py-2 text-black focus:outline-none focus:border-accent-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addMediaFile}
                  className="mt-4 bg-ink-100 text-ink-800 px-4 py-2 rounded-field hover:bg-ink-200 transition-colors flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Media File
                </button>
              </form>
      </Modal>
    </div>
  );
};

export default MediaBlogManagement;