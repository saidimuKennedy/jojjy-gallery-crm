import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import path from "path";
import { requireAnyPermission } from "@/lib/require-permission";
import { slugify } from "@/lib/slugify";
import { APIError } from "@/types/api";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

interface ImageUploadSuccessResponse {
  success: boolean;
  message: string;
  imageUrl: string;
  publicId: string;
}

function fieldValue(
  fields: formidable.Fields,
  key: string
): string | undefined {
  const value = fields[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function resolvePublicId(
  fields: formidable.Fields,
  originalFilename: string | null
): string {
  const explicit = fieldValue(fields, "publicId");
  if (explicit) return slugify(explicit);

  const artworkTitle = fieldValue(fields, "artworkTitle");
  if (artworkTitle) return slugify(artworkTitle);

  if (originalFilename) {
    const base = path.basename(originalFilename, path.extname(originalFilename));
    if (base) return slugify(base);
  }

  return "upload";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ImageUploadSuccessResponse | APIError>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const auth = await requireAnyPermission(req, res, [
    "artworks:write",
    "music:write",
  ]);
  if (!auth) return;

  const form = formidable({});

  try {
    const [fields, files] = await form.parse(req);

    if (!files.file || files.file.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded." });
    }

    const uploadedFile = files.file[0];
    const folder = fieldValue(fields, "folder") || "artwork_uploads";
    const publicIdBase = resolvePublicId(fields, uploadedFile.originalFilename);

    const cloudinaryResponse = await cloudinary.uploader.upload(
      uploadedFile.filepath,
      {
        folder,
        public_id: publicIdBase,
        overwrite: false,
        unique_filename: true,
      }
    );

    await fs.unlink(uploadedFile.filepath);

    return res.status(200).json({
      success: true,
      message: "Image uploaded to Cloudinary successfully!",
      imageUrl: cloudinaryResponse.secure_url,
      publicId: cloudinaryResponse.public_id,
    });
  } catch (error) {
    console.error("Error uploading image to Cloudinary:", error);
    return res.status(500).json({
      success: false,
      message:
        (error as Error).message || "Failed to upload image to Cloudinary.",
    });
  }
}
