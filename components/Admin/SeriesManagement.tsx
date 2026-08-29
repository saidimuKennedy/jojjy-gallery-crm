import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit3, Trash2, X, AlertCircle } from "lucide-react";
import useSWR from "swr";
import { APIError } from "@/types/api";
import { Series } from "@prisma/client";

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

  if (isLoading)
    return <div className="text-center py-8">Loading series...</div>;
  if (error)
    return (
      <div className="text-center py-8 text-red-500">
        Error: {error.message}
      </div>
    );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-black">Manage Series</h2>
        <button
          onClick={handleAddSeries}
          className="bg-black text-white px-6 py-3 rounded-md hover:bg-gray-800 transition-colors flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" /> Add New Series
        </button>
      </div>

      {seriesList && seriesList.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No series found. Add your first series!
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Slug
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
              {seriesList?.map((series) => (
                <tr key={series.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {series.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                    <div className="truncate" title={series.description || ""}>
                      {series.description || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {series.slug}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(series.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEditSeries(series)}
                      className="text-gray-900 hover:text-black mr-4"
                    >
                      <Edit3 className="w-5 h-5 inline-block" />
                    </button>
                    <button
                      onClick={() => handleDeleteSeries(series.id)}
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

      {/* Add/Edit Series Modal */}
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
              className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md relative overflow-y-auto max-h-[90vh]"
            >
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-2xl font-bold mb-6 text-gray-800">
                {editingSeries ? "Edit Series" : "Add New Series"}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-black mb-2"
                  >
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleNameChange}
                    required
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label
                    htmlFor="slug"
                    className="block text-sm font-medium text-black mb-2"
                  >
                    Slug (Auto-generated)
                  </label>
                  <input
                    type="text"
                    id="slug"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    readOnly
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black bg-gray-100 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-black mb-2"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                  ></textarea>
                </div>
                <div>
                  <label
                    htmlFor="introduction"
                    className="block text-sm font-medium text-black mb-2"
                  >
                    Introduction (exhibition page)
                  </label>
                  <textarea
                    id="introduction"
                    name="introduction"
                    value={formData.introduction}
                    onChange={handleChange}
                    rows={3}
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                  ></textarea>
                </div>
                <div>
                  <label
                    htmlFor="artistStatement"
                    className="block text-sm font-medium text-black mb-2"
                  >
                    Artist statement
                  </label>
                  <textarea
                    id="artistStatement"
                    name="artistStatement"
                    value={formData.artistStatement}
                    onChange={handleChange}
                    rows={4}
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                  ></textarea>
                </div>
                <div>
                  <label
                    htmlFor="filmUrl"
                    className="block text-sm font-medium text-black mb-2"
                  >
                    Film URL (YouTube / Vimeo)
                  </label>
                  <input
                    type="url"
                    id="filmUrl"
                    name="filmUrl"
                    value={formData.filmUrl}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                  />
                </div>

                {submitError && (
                  <div
                    className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
                    role="alert"
                  >
                    <strong className="font-bold">Error!</strong>
                    <span className="block sm:inline"> {submitError}</span>
                  </div>
                )}
                {successMessage && (
                  <div
                    className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4"
                    role="alert"
                  >
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
                      ? editingSeries
                        ? "Updating..."
                        : "Adding..."
                      : editingSeries
                      ? "Update Series"
                      : "Add Series"}
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

export default SeriesManagement;
