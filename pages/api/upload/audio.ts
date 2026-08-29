import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import { requirePermission } from "@/lib/require-permission";

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  if (!(await requirePermission(req, res, "music:write"))) return;

  const form = formidable({
    maxFileSize: 100 * 1024 * 1024,
  });

  try {
    const [, files] = await form.parse(req);
    if (!files.file || files.file.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded." });
    }

    const uploadedFile = files.file[0];

    const result = await cloudinary.uploader.upload(uploadedFile.filepath, {
      folder: "music_tracks",
      resource_type: "video",
      type: "authenticated",
    });

    await fs.unlink(uploadedFile.filepath).catch(() => undefined);

    return res.status(200).json({
      success: true,
      message: "Audio uploaded",
      storageKey: result.public_id,
      duration: result.duration ? Math.round(result.duration) : null,
      fileSize: uploadedFile.size ?? null,
      bitrate: null,
    });
  } catch (error) {
    console.error("music audio upload", error);
    return res.status(500).json({
      success: false,
      message:
        (error as Error).message || "Failed to upload audio to Cloudinary.",
    });
  }
}
