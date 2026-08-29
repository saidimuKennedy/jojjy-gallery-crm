import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit3,
  Eye,
  Trash2,
  X,
  Calendar,
  Tag,
  ImageIcon,
  Mic,
  Video,
  Link,
  RulerDimensionLineIcon,
  DollarSign,
  GalleryHorizontal,
  CheckCircle,
  ArrowUpRight,
  Square,
  AlertCircle,
} from "lucide-react";
import { useArtworks, useSeriesList } from "@/hooks/useArtWorks";
import { ArtworkWithRelations, Series, APIError } from "@/types/api";

type ArtworkStatusValue =
  | "AVAILABLE"
  | "RESERVED"
  | "ON_EXHIBITION"
  | "SOLD"
  | "IN_PRIVATE_COLLECTION";

const ARTWORK_STATUS_OPTIONS: { value: ArtworkStatusValue; label: string }[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "RESERVED", label: "Reserved" },
  { value: "ON_EXHIBITION", label: "On Exhibition" },
  { value: "SOLD", label: "Sold" },
  { value: "IN_PRIVATE_COLLECTION", label: "In Private Collection" },
];

interface ArtworkMediaFilePayload {
  id?: number;
  url: string;
  type: "IMAGE" | "VIDEO" | "AUDIO" | "3D_MODEL" | "EXTERNAL_LINK";
  description: string | null;
  thumbnailUrl: string | null;
  order?: number;
}

interface ArtworkFormData {
  title: string;
  category: string;
  description: string | null;
  medium: string;
  dimensions: string | null; 
  year: number | "";
  price: number | "";
  inGallery: boolean;
  isAvailable: boolean;
  status: ArtworkStatusValue;
  seriesId: number | null;
  imageFile: File | null;
  imageUrl: string | null;
  mediaFiles: Partial<ArtworkMediaFilePayload>[];
  artist: string;
}

const ArtworksManagement = () => {
  const { artworks, isLoading, error, mutate } = useArtworks({ limit: "all" });
  const { seriesList, isLoading: seriesLoading } = useSeriesList();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArtwork, setEditingArtwork] =
    useState<ArtworkWithRelations | null>(null);

  const [formData, setFormData] = useState<ArtworkFormData>({
    title: "",
    category: "",
    description: null,
    medium: "",
    dimensions: null, 
    year: "",
    price: "",
    inGallery: false,
    isAvailable: true,
    status: "AVAILABLE",
    seriesId: null,
    imageFile: null,
    imageUrl: "",   mediaFiles: [],
    artist: "",
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isModalOpen) {
      setEditingArtwork(null);
      setFormData({
        title: "",
        category: "",
        description: null,
        medium: "",
        dimensions: null,
        year: "",
        price: "",
        inGallery: false,
        isAvailable: true,
        status: "AVAILABLE",
        seriesId: null,
        imageFile: null,
        imageUrl: "",
        mediaFiles: [],
        artist: "",
      });
      setSubmitError(null);
      setSuccessMessage(null);
    } else if (editingArtwork) {
      setFormData({
        title: editingArtwork.title || "",
        category: editingArtwork.category || "",
        description: editingArtwork.description || null,
        medium: editingArtwork.medium || "",
        dimensions: editingArtwork.dimensions || null,
        year: editingArtwork.year === null ? "" : editingArtwork.year,
        price: editingArtwork.price === null ? "" : editingArtwork.price,
        inGallery: editingArtwork.inGallery ?? false,
        isAvailable: editingArtwork.isAvailable ?? true,
        status: (editingArtwork.status as ArtworkStatusValue) || "AVAILABLE",
        seriesId: editingArtwork.series?.id || null,
        imageFile: null,
        artist: editingArtwork.artist || "",
        imageUrl: editingArtwork.imageUrl || "",    mediaFiles:
          editingArtwork.mediaFiles?.map((mf) => ({
            id: mf.id,
            url: mf.url,
            type: mf.type as ArtworkMediaFilePayload["type"], description: mf.description,
            thumbnailUrl: mf.thumbnailUrl,
            order: mf.order,
          })) || [],
      });
    }
  }, [isModalOpen, editingArtwork]);

  const openCreateModal = () => {
    setEditingArtwork(null);
    setIsModalOpen(true);
  };

  const openEditModal = (artwork: ArtworkWithRelations) => {
    setEditingArtwork(artwork);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    let newValue: string | number | boolean | null = value;

    if (type === "checkbox") {
      newValue = (e.target as HTMLInputElement).checked;
    } else if (name === "year" || name === "price" || name === "seriesId") {
           newValue = value === "" ? null : Number(value);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData((prev) => ({
        ...prev,
        imageFile: e.target.files![0],
        imageUrl: URL.createObjectURL(e.target.files![0]),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        imageFile: null,
        imageUrl: "",
      }));
    }
  };

  const handleMediaFileChange = (
    index: number,
    field: keyof ArtworkMediaFilePayload,
    value: string
  ) => {
    const updatedMediaFiles = [...formData.mediaFiles];
    updatedMediaFiles[index] = { ...updatedMediaFiles[index], [field]: value };
    setFormData((prev) => ({ ...prev, mediaFiles: updatedMediaFiles }));
  };

  const addMediaFile = () => {
    setFormData((prev) => ({
      ...prev,
      mediaFiles: [
        ...prev.mediaFiles,
        {
          url: "",
          type: "IMAGE", 
          description: null,
          thumbnailUrl: null,
          order: formData.mediaFiles.length, 
        },
      ],
    }));
  };

  const removeMediaFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      mediaFiles: prev.mediaFiles.filter((_, i) => i !== index),
    }));
  };

  const saveArtwork = async () => {
    if (
      !formData.title ||
      !formData.artist ||
      !formData.category ||
      !formData.medium ||
      !formData.imageUrl ||
      formData.year === "" ||
      formData.price === ""
    ) {
      setSubmitError(
        "Please fill in all required fields (Title, Artist, Category, Medium, Year, Price, and upload a Main Image)."
      );
      return;
    }
    setSubmitError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    interface ArtworkApiPayload {
      title: string;
      description: string | null;
      medium: string;
      dimensions: string | null;
      year: number; 
      price: number; 
      inGallery: boolean;
      isAvailable: boolean;
      status: ArtworkStatusValue;
      seriesId: number | null;
      imageUrl: string;
      category: string;
      mediaFiles: ArtworkMediaFilePayload[];
      artist: string;
    }

    const dataToSave: ArtworkApiPayload = {
      title: formData.title,
      description: formData.description,
      medium: formData.medium,
      dimensions: formData.dimensions, 
      category: formData.category,
      year: Number(formData.year),
      price: Number(formData.price),
      inGallery: formData.inGallery,
      isAvailable: formData.isAvailable,
      status: formData.status,
      seriesId: formData.seriesId,
      imageUrl: formData.imageUrl,
      artist: formData.artist,
      mediaFiles: formData.mediaFiles.map((mf, idx) => ({
        ...(mf.id !== undefined && mf.id !== null && { id: mf.id }),
        url: mf.url!,
        type: mf.type!,
        description: mf.description || null,
        thumbnailUrl: mf.thumbnailUrl || null,
        order: mf.order ?? idx, // Ensure order is set for new files
      })),
    };

    // Handle main image upload if a new file is selected
    if (formData.imageFile) {
      try {
        const uploadFormData = new FormData();
        uploadFormData.append("file", formData.imageFile);
        if (formData.title?.trim()) {
          uploadFormData.append("artworkTitle", formData.title.trim());
        }

        const uploadResponse = await fetch("/api/upload/image", {
          method: "POST",
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.message || "Image upload failed");
        }
        const uploadResult = await uploadResponse.json();
        dataToSave.imageUrl = uploadResult.imageUrl; // Update imageUrl after successful upload
      } catch (uploadError: any) {
        console.error("Image upload error:", uploadError);
        setSubmitError(uploadError.message || "Failed to upload main image.");
        setIsSubmitting(false);
        return;
      }
    } else if (!formData.imageUrl) {
      // If no new file is uploaded and no existing imageUrl, it's an error because imageUrl is required
      setSubmitError("A main image is required for the artwork.");
      setIsSubmitting(false);
      return;
    }

    try {
      let response;
      if (editingArtwork) {
        response = await fetch(`/api/artworks/${editingArtwork.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataToSave),
        });
      } else {
        response = await fetch("/api/artworks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataToSave),
        });
      }

      if (!response.ok) {
        const errorData: APIError = await response.json();
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      setSuccessMessage(
        editingArtwork ? "Artwork updated!" : "Artwork created!"
      );
      await mutate(); // Revalidate SWR cache
      setTimeout(() => closeModal(), 1500); // Close modal after success
    } catch (apiError: any) {
      console.error("API error:", apiError);
      setSubmitError(
        apiError.message || "Failed to save artwork: An unknown error occurred."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteArtwork = async (artworkId: number) => {
    if (
      window.confirm(
        "Are you sure you want to delete this artwork? This action cannot be undone."
      )
    ) {
      setIsSubmitting(true);
      setSubmitError(null);
      setSuccessMessage(null);
      try {
        const response = await fetch(`/api/artworks/${artworkId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const errorData: APIError = await response.json();
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`
          );
        }

        setSuccessMessage("Artwork deleted successfully!");
        mutate(); // Revalidate SWR cache
      } catch (apiError: any) {
        console.error("API error:", apiError);
        setSubmitError(
          apiError.message ||
            "Failed to delete artwork: An unknown error occurred."
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (isLoading || seriesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-900 animate-spin rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Error Loading page:{" "}
        {typeof error === "object" && error !== null && "message" in error
          ? (error as any).message
          : String(error)}
      </div>
    );
  }

  return (
    <div className="py-8">
      <motion.div
        className="flex justify-between items-start mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div>
          <h1 className="text-4xl font-light text-black mb-2">
            Artwork Management
          </h1>
          <p className="text-gray-600 text-lg">
            Create and manage your art pieces
          </p>
        </div>
        <motion.button
          onClick={openCreateModal}
          className="bg-black text-white px-6 py-3 hover:bg-gray-800 transition-colors flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus size={20} />
          New Artwork
        </motion.button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {artworks.length === 0 ? (
          <div className="lg:col-span-3 text-center py-12 text-gray-500">
            No artworks found. Click "New Artwork" to add your first piece.
          </div>
        ) : (
          artworks.map((artwork, index) => (
            <motion.div
              key={artwork.id}
              className="bg-white border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * index }}
              whileHover={{ y: -8 }}
            >
              <div className="h-48 bg-gray-100 relative flex items-center justify-center overflow-hidden">
                {artwork.imageUrl ? (
                  <img
                    src={artwork.imageUrl}
                    alt={artwork.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center text-gray-400">
                    <ImageIcon size={32} />
                    <span className="text-sm mt-2">No Image</span>
                  </div>
                )}

                <div className="absolute top-3 right-3 flex gap-2">
                  {artwork.inGallery && (
                    <div className="px-3 py-1 text-xs font-medium bg-black text-white">
                      IN GALLERY
                    </div>
                  )}
                  {artwork.status && artwork.status !== "AVAILABLE" && (
                    <div className="px-3 py-1 text-xs font-medium bg-red-600 text-white">
                      {ARTWORK_STATUS_OPTIONS.find(
                        (o) => o.value === artwork.status
                      )?.label ?? artwork.status}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6">
                <h3 className="text-xl font-medium text-black mb-3 line-clamp-2">
                  {artwork.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {artwork.description}
                </p>

                <div className="text-xs text-gray-500 mb-4 space-y-1">
                  {artwork.series && (
                    <div className="flex items-center gap-1">
                      <Tag size={12} />
                      <span>Series: {artwork.series.name}</span>
                    </div>
                  )}
                  {artwork.year && (
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      <span>Year: {artwork.year}</span>
                    </div>
                  )}
                  {artwork.dimensions && (
                    <div className="flex items-center gap-1">
                      <RulerDimensionLineIcon size={12} />
                      <span>Size: {artwork.dimensions}</span>
                    </div>
                  )}
                  {artwork.price && (
                    <div className="flex items-center gap-1">
                      <DollarSign size={12} />
                      <span>Price: ${artwork.price.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <>
                    <motion.button
                      onClick={() => openEditModal(artwork)}
                      className="flex-1 border border-gray-300 text-gray-700 py-2 px-3 text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Edit3 size={14} />
                      Edit
                    </motion.button>
                    <motion.button
                      onClick={() => deleteArtwork(artwork.id)}
                      className="border border-gray-300 text-gray-700 py-2 px-3 text-sm hover:bg-red-50 transition-colors flex items-center justify-center"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Trash2 size={14} />
                    </motion.button>
                  </>
                  <motion.button
                    onClick={() =>
                      window.open(`/artworks/${artwork.id}`, "_blank")
                    }
                    className="flex-1 border border-gray-300 text-gray-700 py-2 px-3 text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Eye size={14} />
                    View
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add/Edit Artwork Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h2 className="text-2xl font-light text-black">
                  {editingArtwork ? "Edit Artwork" : "New Artwork"}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-black transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-black mb-2"
                  >
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                    placeholder="Enter artwork title"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="artist"
                    className="block text-sm font-medium text-black mb-2"
                  >
                    Artist <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="artist"
                    name="artist"
                    value={formData.artist}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                    placeholder="Enter artist's name"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="category"
                    className="block text-sm font-medium text-black mb-2"
                  >
                    Category <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                    placeholder="e.g., Abstract, Portrait, Landscape"
                    required
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
                    value={formData.description || ""}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                    placeholder="Provide a detailed description of the artwork"
                  ></textarea>
                </div>

                <div>
                  <label
                    htmlFor="medium"
                    className="block text-sm font-medium text-black mb-2"
                  >
                    Medium <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="medium"
                    name="medium"
                    value={formData.medium}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                    placeholder="e.g., Ink and bleach on paper"
                    required
                  />
                </div>

                {/* NEW: Dimensions Input */}
                <div>
                  <label
                    htmlFor="dimensions"
                    className="block text-sm font-medium text-black mb-2"
                  >
                    Dimensions (Size)
                  </label>
                  <input
                    type="text"
                    id="dimensions"
                    name="dimensions"
                    value={formData.dimensions || ""}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                    placeholder="e.g., 24 x 36 inches"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="year"
                      className="block text-sm font-medium text-black mb-2"
                    >
                      Year <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="year"
                      name="year"
                      value={formData.year}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                      placeholder="e.g., 2024"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="price"
                      className="block text-sm font-medium text-black mb-2"
                    >
                      Price ($) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="price"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                      placeholder="e.g., 1500"
                      required
                    />
                  </div>
                </div>

                {/* NEW: Series Dropdown */}
                <div>
                  <label
                    htmlFor="seriesId"
                    className="block text-sm font-medium text-black mb-2"
                  >
                    Series
                  </label>
                  <select
                    id="seriesId"
                    name="seriesId"
                    value={formData.seriesId || ""} // Use "" for null to display placeholder
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                  >
                    <option value="">-- Select Series (Optional) --</option>
                    {seriesList.map((series) => (
                      <option key={series.id} value={series.id}>
                        {series.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Checkboxes */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="inGallery"
                      name="inGallery"
                      checked={formData.inGallery}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-black border-gray-300 rounded focus:ring-black"
                    />
                    <label
                      htmlFor="inGallery"
                      className="ml-2 block text-sm text-black"
                    >
                      In Gallery
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isAvailable"
                      name="isAvailable"
                      checked={formData.isAvailable}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-black border-gray-300 rounded focus:ring-black"
                    />
                    <label
                      htmlFor="isAvailable"
                      className="ml-2 block text-sm text-black"
                    >
                      Available for Purchase
                    </label>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="status"
                    className="block text-sm font-medium text-black mb-2"
                  >
                    Collector Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    {ARTWORK_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Sold or collected works stay visible on the site instead
                    of disappearing.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="imageFile"
                    className="block text-sm font-medium text-black mb-2"
                  >
                    Artwork Main Image <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    id="imageFile"
                    name="imageFile"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full border border-gray-300 px-3 py-2 text-black focus:outline-none focus:border-black"
                  />
                  {formData.imageUrl && (
                    <div className="mt-4 flex items-center gap-4">
                      <img
                        src={formData.imageUrl}
                        alt="Artwork Preview"
                        className="h-24 w-24 object-cover border border-gray-200"
                      />
                      <p className="text-sm text-gray-600">
                        Current Main Image
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            imageUrl: "",
                            imageFile: null,
                          }))
                        }
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove Main Image
                      </button>
                    </div>
                  )}
                </div>

                {/* Additional Media Files section */}
                <h3 className="text-lg font-medium text-black mt-6 mb-4">
                  Additional Media Files
                </h3>
                <div className="space-y-4">
                  {formData.mediaFiles.map((mf, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 p-4 rounded-md space-y-3 relative"
                    >
                      <button
                        type="button"
                        onClick={() => removeMediaFile(index)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-600"
                        title="Remove media file"
                      >
                        <X size={18} />
                      </button>
                      <div>
                        <label
                          htmlFor={`media-url-${index}`}
                          className="block text-xs font-medium text-black mb-1"
                        >
                          URL
                        </label>
                        <input
                          type="text"
                          id={`media-url-${index}`}
                          value={mf.url || ""}
                          onChange={(e) =>
                            handleMediaFileChange(index, "url", e.target.value)
                          }
                          className="w-full border border-gray-300 px-2 py-1 text-black text-sm focus:outline-none focus:border-black"
                          placeholder="Media URL"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`media-type-${index}`}
                          className="block text-xs font-medium text-black mb-1"
                        >
                          Type
                        </label>
                        <select
                          id={`media-type-${index}`}
                          value={mf.type || "IMAGE"}
                          onChange={(e) =>
                            handleMediaFileChange(index, "type", e.target.value)
                          }
                          className="w-full border border-gray-300 px-2 py-1 text-black text-sm focus:outline-none focus:border-black"
                        >
                          <option value="IMAGE">Image</option>
                          <option value="VIDEO">Video</option>
                          <option value="AUDIO">Audio</option>
                          <option value="3D_MODEL">3D Model</option>
                          <option value="EXTERNAL_LINK">External Link</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor={`media-description-${index}`}
                          className="block text-xs font-medium text-black mb-1"
                        >
                          Description
                        </label>
                        <input
                          type="text"
                          id={`media-description-${index}`}
                          value={mf.description || ""}
                          onChange={(e) =>
                            handleMediaFileChange(
                              index,
                              "description",
                              e.target.value
                            )
                          }
                          className="w-full border border-gray-300 px-2 py-1 text-black text-sm focus:outline-none focus:border-black"
                          placeholder="Description (optional)"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`media-thumbnail-${index}`}
                          className="block text-xs font-medium text-black mb-1"
                        >
                          Thumbnail URL
                        </label>
                        <input
                          type="text"
                          id={`media-thumbnail-${index}`}
                          value={mf.thumbnailUrl || ""}
                          onChange={(e) =>
                            handleMediaFileChange(
                              index,
                              "thumbnailUrl",
                              e.target.value
                            )
                          }
                          className="w-full border border-gray-300 px-2 py-1 text-black text-sm focus:outline-none focus:border-black"
                          placeholder="Thumbnail URL (optional)"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addMediaFile}
                  className="mt-4 bg-gray-100 text-black px-4 py-2 text-sm hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <Plus size={16} /> Add Media File
                </button>

                <div className="p-6 border-t border-gray-200 flex justify-end items-center gap-4">
                  {submitError && (
                    <div className="flex items-center text-red-600 text-sm gap-1">
                      <AlertCircle size={16} />
                      <span>{submitError}</span>
                    </div>
                  )}
                  {successMessage && (
                    <div className="flex items-center text-green-600 text-sm gap-1">
                      <CheckCircle size={16} />
                      <span>{successMessage}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <motion.button
                    onClick={saveArtwork}
                    className="bg-black text-white px-6 py-3 hover:bg-gray-800 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </span>
                    ) : editingArtwork ? (
                      "Update Artwork"
                    ) : (
                      "Create Artwork"
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ArtworksManagement;
