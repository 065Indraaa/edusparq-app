import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

/**
 * Returns true only when real (non-empty) Cloudinary credentials are present.
 * `.env.local` ships with placeholders, so callers must degrade gracefully.
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    cloudName &&
      apiKey &&
      apiSecret &&
      !cloudName.includes("your_") &&
      !apiKey.includes("your_") &&
      !apiSecret.includes("your_")
  );
}

/**
 * Uploads a Buffer to Cloudinary using upload_stream wrapped in a Promise.
 * Uses resource_type "auto" so PDFs, audio, video and images all work.
 */
export function uploadBuffer(
  buffer: Buffer,
  folder: string,
  filename?: string
): Promise<{ url: string; publicId: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary belum dikonfigurasi");
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        ...(filename ? { public_id: filename.replace(/\.[^/.]+$/, "") } : {}),
        use_filename: Boolean(filename),
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error("Upload Cloudinary gagal"));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Best-effort deletion of a Cloudinary asset. Never throws.
 */
export async function destroyAsset(publicId: string): Promise<void> {
  if (!isCloudinaryConfigured() || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
  } catch {
    // best-effort, ignore errors
  }
}
