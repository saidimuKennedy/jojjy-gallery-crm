import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit3, Trash2, X, AlertCircle, Image, Video, Mic, ExternalLink, FileText } from "lucide-react";
import useSWR from "swr";
import { APIError } from "@/types/api";
import { MediaBlogEntry, MediaBlogFile, MediaBlogEntryType, MediaFileType } from "@prisma/client";

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
    setIsSubmitting(true);

    const method = editingEntry ? "PUT" : "POST";
    const url = editingEntry ? `/api/media-blog/${editingEntry.id}` : "/api/media-blog";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
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

  if (isLoading)
    return <div className="text-center py-8">Loading media blog entries...</div>;
  if (error)
    return (
      <div className="text-center py-8 text-red-500">
        Error: {error.message}
      </div>
    );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-black">Manage Media & Blog Entries</h2>
        <button
          onClick={handleAddEntry}
          className="bg-black text-white px-6 py-3 rounded-md hover:bg-gray-800 transition-colors flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" /> Add New Entry
        </button>
      </div>

      {mediaBlogEntries && mediaBlogEntries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No media blog entries found. Add your first entry!
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Short Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Files
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mediaBlogEntries?.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {entry.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.type}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                    <div className="truncate" title={entry.shortDesc || ""}>
                      {entry.shortDesc || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.mediaFiles.length > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {entry.mediaFiles.length} files
                      </span>
                    ) : (
                      "No files"
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEditEntry(entry)}
                      className="text-gray-900 hover:text-black mr-4"
                    >
                      <Edit3 className="w-5 h-5 inline-block" />
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-5 h-5 inline-block" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl relative overflow-y-auto max-h-[90vh]"
            >
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-2xl font-bold mb-6 text-gray-800">
                {editingEntry ? "Edit Media Blog Entry" : "Add New Media Blog Entry"}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
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
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black bg-white"
                  >
                    {Object.values(MediaBlogEntryType).map((type) => (
                      <option key={type} value={type}>
                        {type.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="shortDesc" className="block text-sm font-medium text-black mb-2">
                    Short Description
                  </label>
                  <textarea
                    id="shortDesc"
                    name="shortDesc"
                    value={formData.shortDesc}
                    onChange={handleChange}
                    rows={2}
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
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
                      className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                      placeholder="https://example.com/blog-post"
                    />
                  </div>
                )}
                 {(formData.type === MediaBlogEntryType.VIDEO || formData.type === MediaBlogEntryType.AUDIO) && (
                  <>
                    <div>
                      <label htmlFor="thumbnailUrl" className="block text-sm font-medium text-black mb-2">
                        Thumbnail URL (for video/audio cover)
                      </label>
                      <input
                        type="url"
                        id="thumbnailUrl"
                        name="thumbnailUrl"
                        value={formData.thumbnailUrl}
                        onChange={handleChange}
                        className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                        placeholder="https://example.com/thumbnail.jpg"
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
                        className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
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
                      className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                    ></textarea>
                  </div>
                )}

                <h4 className="text-xl font-bold mt-6 mb-3 text-gray-800">Associated Media Files</h4>
                {formData.mediaFiles.length === 0 && (
                  <p className="text-gray-500">No media files added yet.</p>
                )}
                <div className="space-y-4">
                  {formData.mediaFiles.map((mediaFile, index) => (
                    <div key={mediaFile.id || `new-${index}`} className="border p-4 rounded-md bg-gray-50 relative">
                      <button
                        type="button"
                        onClick={() => removeMediaFile(index)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor={`media-url-${index}`} className="block text-sm font-medium text-black mb-2">
                            URL
                          </label>
                          <input
                            type="url"
                            id={`media-url-${index}`}
                            name="url"
                            value={mediaFile.url}
                            onChange={(e) => handleMediaFileChange(index, e)}
                            required
                            className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
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
                            className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black bg-white"
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
                            className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                          ></textarea>
                        </div>
                        {(mediaFile.type === MediaFileType.VIDEO || mediaFile.type === MediaFileType.AUDIO) && (
                          <div className="col-span-2">
                            <label htmlFor={`media-thumbnail-${index}`} className="block text-sm font-medium text-black mb-2">
                              Thumbnail URL (for file specific)
                            </label>
                            <input
                              type="url"
                              id={`media-thumbnail-${index}`}
                              name="thumbnailUrl"
                              value={mediaFile.thumbnailUrl || ""}
                              onChange={(e) => handleMediaFileChange(index, e)}
                              className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                              placeholder="https://example.com/file-thumbnail.jpg"
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
                            className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addMediaFile}
                  className="mt-4 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Media File
                </button>

                {submitError && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <strong className="font-bold">Error!</strong>
                    <span className="block sm:inline"> {submitError}</span>
                  </div>
                )}
                {successMessage && (
                  <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <strong className="font-bold">Success!</strong>
                    <span className="block sm:inline"> {successMessage}</span>
                  </div>
                )}

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-black text-white px-6 py-3 hover:bg-gray-800 transition-colors"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? editingEntry
                        ? "Updating..."
                        : "Adding..."
                      : editingEntry
                      ? "Update Entry"
                      : "Add Entry"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MediaBlogManagement;