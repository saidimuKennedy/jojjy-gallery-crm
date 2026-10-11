import React, { useState, useEffect } from "react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SectionHeading,
  Select,
  StatusBadge,
  TextArea,
  TextField,
} from "@/components/ui";
import {
  Plus,
  Edit3,
  Eye,
  Trash2,
  X,
  Calendar,
  Tag,
  ImageIcon,
  RulerDimensionLineIcon,
  DollarSign,
} from "lucide-react";
import { useArtworks, useSeriesList } from "@/hooks/useArtWorks";
import { ArtworkWithRelations, Series, APIError } from "@/types/api";
import MediaUrlField from "@/components/Admin/MediaUrlField";
import { normalizeMediaUrl } from "@/lib/media-url";
import { useResumeAction } from "@/hooks/useResumeAction";
import { useFormDraft } from "@/hooks/useFormDraft";

const emptyArtworkForm = (): ArtworkFormData => ({
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
  type: "IMAGE" | "VIDEO" | "AUDIO";
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

  // Local draft persistence. Declared after the populate effect so a
  // restored draft applies on top of server values. imageFile (a File
  // object) is stripped: only uploaded URLs persist; an un-uploaded file
  // must be reselected after restore.
  const artworkDraftKey = isModalOpen
    ? editingArtwork
      ? `jenga:crm:draft:artwork:${editingArtwork.id}`
      : "jenga:crm:draft:artwork:new"
    : null;
  const artworkDraft = useFormDraft({
    draftKey: artworkDraftKey,
    values: formData,
    emptyValues: emptyArtworkForm(),
    fileKeys: ["imageFile"],
    onRestore: (v) => setFormData(v),
    enabled: isModalOpen,
  });

  useResumeAction({
    domain: "artwork",
    rows: artworks,
    onNew: () => openCreateModal(),
    onEdit: (row) => openEditModal(row),
  });

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
      artworkDraft.clear();
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
        <div className="w-12 h-12 border-4 border-border border-t-accent-600 animate-spin rounded-full"></div>
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
    <div>
      <PageHeader
        title="Artwork Management"
        subtitle="Create and manage your art pieces"
        actions={
          <Button onClick={openCreateModal}>
            <Plus size={18} />
            New Artwork
          </Button>
        }
      />

      {artworks.length === 0 ? (
        <EmptyState
          title="No artworks found"
          description='Click "New Artwork" to add your first piece.'
          action={<Button onClick={openCreateModal}>New Artwork</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {artworks.map((artwork) => (
            <Card key={artwork.id} padded={false} className="flex flex-col overflow-hidden">
              <div className="relative h-48 overflow-hidden bg-ink-100">
                {artwork.imageUrl ? (
                  <img
                    src={artwork.imageUrl}
                    alt={artwork.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-ink-400">
                    <ImageIcon size={32} />
                    <span className="mt-2 text-sm">No image</span>
                  </div>
                )}
                <div className="absolute right-3 top-3 flex gap-2">
                  {artwork.inGallery && (
                    <StatusBadge tone="info">In gallery</StatusBadge>
                  )}
                  {artwork.status && artwork.status !== "AVAILABLE" && (
                    <StatusBadge tone="danger">
                      {ARTWORK_STATUS_OPTIONS.find(
                        (o) => o.value === artwork.status
                      )?.label ?? artwork.status}
                    </StatusBadge>
                  )}
                </div>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="mb-2 line-clamp-2 text-lg font-semibold text-ink-900">
                  {artwork.title}
                </h3>
                <p className="mb-4 line-clamp-3 text-sm text-ink-500">
                  {artwork.description}
                </p>

                <div className="mb-4 space-y-1 text-xs text-ink-500">
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

                <div className="mt-auto flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => openEditModal(artwork)}
                  >
                    <Edit3 size={14} /> Edit
                  </Button>
                  <Button
                    variant="secondary"
                    aria-label="Delete artwork"
                    onClick={() => deleteArtwork(artwork.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => window.open(`/artworks/${artwork.id}`, "_blank")}
                  >
                    <Eye size={14} /> View
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Artwork Modal */}
      <Modal
        open={isModalOpen}
        title={editingArtwork ? "Edit artwork" : "New artwork"}
        description={
          editingArtwork
            ? "Update artwork details"
            : "Add a new piece to the gallery"
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
            {artworkDraft.savedAt && (
              <span className="mr-auto text-xs text-ink-400">
                Draft saved locally
              </span>
            )}
            <Button variant="secondary" onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={saveArtwork} disabled={isSubmitting}>
              {isSubmitting
                ? "Saving…"
                : editingArtwork
                  ? "Update Artwork"
                  : "Create Artwork"}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          {artworkDraft.recovered && (
            <p className="text-xs text-ink-500">
              Draft recovered —{" "}
              <button
                type="button"
                onClick={() => {
                  artworkDraft.discard();
                  if (editingArtwork) setEditingArtwork({ ...editingArtwork });
                  else setFormData(emptyArtworkForm());
                }}
                className="text-accent-700 underline-offset-2 hover:underline"
              >
                discard
              </button>
            </p>
          )}

          <Field label="Title" required>
            <TextField
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter artwork title"
              required
            />
          </Field>
          <Field label="Artist" required>
            <TextField
              name="artist"
              value={formData.artist}
              onChange={handleInputChange}
              placeholder="Enter artist's name"
              required
            />
          </Field>
          <Field label="Category" required>
            <TextField
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              placeholder="e.g., Abstract, Portrait, Landscape"
              required
            />
          </Field>
          <Field label="Description">
            <TextArea
              name="description"
              value={formData.description || ""}
              onChange={handleInputChange}
              rows={3}
              placeholder="Provide a detailed description of the artwork"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Medium" required>
              <TextField
                name="medium"
                value={formData.medium}
                onChange={handleInputChange}
                placeholder="e.g., Ink and bleach on paper"
                required
              />
            </Field>
            <Field label="Dimensions (size)">
              <TextField
                name="dimensions"
                value={formData.dimensions || ""}
                onChange={handleInputChange}
                placeholder="e.g., 24 x 36 inches"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Year" required>
              <TextField
                type="number"
                name="year"
                value={formData.year}
                onChange={handleInputChange}
                placeholder="e.g., 2024"
                required
              />
            </Field>
            <Field label="Price ($)" required>
              <TextField
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="e.g., 1500"
                required
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Series">
              <Select
                name="seriesId"
                value={formData.seriesId || ""}
                onChange={handleInputChange}
              >
                <option value="">-- Select Series (optional) --</option>
                {seriesList.map((series) => (
                  <option key={series.id} value={series.id}>
                    {series.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Collector status"
              hint="Sold or collected works stay visible on the site instead of disappearing."
            >
              <Select name="status" value={formData.status} onChange={handleInputChange}>
                {ARTWORK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                name="inGallery"
                checked={formData.inGallery}
                onChange={handleInputChange}
                className="h-4 w-4 rounded border-border text-accent-600 focus:ring-accent-100"
              />
              In gallery
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                name="isAvailable"
                checked={formData.isAvailable}
                onChange={handleInputChange}
                className="h-4 w-4 rounded border-border text-accent-600 focus:ring-accent-100"
              />
              Available for purchase
            </label>
          </div>

          <div>
            <Field label="Artwork main image" required>
              <input
                type="file"
                name="imageFile"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full rounded-field border border-border bg-surface px-3 py-2 text-sm text-ink-700"
              />
            </Field>
            <TextField
              type="url"
              placeholder="…or paste an image link (Drive, Dropbox, URL)"
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const el = e.target as HTMLInputElement;
                const { url, error } = normalizeMediaUrl(el.value);
                if (error || !url) {
                  setSubmitError(error || "Invalid link.");
                  return;
                }
                setSubmitError(null);
                setFormData((prev) => ({ ...prev, imageUrl: url, imageFile: null }));
                el.value = "";
              }}
            />
            {formData.imageUrl && (
              <div className="mt-3 flex items-center gap-4">
                <img
                  src={formData.imageUrl}
                  alt="Artwork preview"
                  className="h-24 w-24 rounded-field border border-border object-cover"
                />
                <p className="text-sm text-ink-600">Current main image</p>
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      imageUrl: "",
                      imageFile: null,
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            )}
          </div>

          <SectionHeading
            action={
              <Button
                variant="secondary"
                className="px-3 py-1.5 text-xs"
                onClick={addMediaFile}
              >
                <Plus size={14} /> Add media file
              </Button>
            }
          >
            Additional media files
          </SectionHeading>
          <div className="space-y-4">
            {formData.mediaFiles.map((mf, index) => (
              <div
                key={index}
                className="relative space-y-3 rounded-field border border-border p-4"
              >
                <Button
                  variant="ghost"
                  className="absolute right-2 top-2 px-1.5 py-1 text-ink-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove media"
                  onClick={() => removeMediaFile(index)}
                >
                  <X size={16} />
                </Button>
                <MediaUrlField
                  label="File"
                  value={mf.url || ""}
                  onChange={(url) => handleMediaFileChange(index, "url", url)}
                />
                <Field label="Type">
                  <Select
                    value={mf.type || "IMAGE"}
                    onChange={(e) =>
                      handleMediaFileChange(index, "type", e.target.value)
                    }
                  >
                    <option value="IMAGE">Image</option>
                    <option value="VIDEO">Video</option>
                    <option value="AUDIO">Audio</option>
                  </Select>
                </Field>
                <Field label="Description">
                  <TextField
                    value={mf.description || ""}
                    onChange={(e) =>
                      handleMediaFileChange(index, "description", e.target.value)
                    }
                    placeholder="Description (optional)"
                  />
                </Field>
                <Field label="Thumbnail URL">
                  <TextField
                    value={mf.thumbnailUrl || ""}
                    onChange={(e) =>
                      handleMediaFileChange(index, "thumbnailUrl", e.target.value)
                    }
                    placeholder="Thumbnail URL (optional)"
                  />
                </Field>
              </div>
            ))}
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ArtworksManagement;
