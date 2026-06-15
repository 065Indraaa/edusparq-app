import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isCloudinaryConfigured, uploadBuffer } from "@/lib/cloudinary";

const MAX_BYTES = 25 * 1024 * 1024; // ~25MB

type FileType = "pdf" | "docx" | "audio" | "video" | "image";

function deriveFileType(mime: string, name: string): FileType {
  const m = (mime || "").toLowerCase();
  const n = (name || "").toLowerCase();

  if (m.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/.test(n)) return "audio";
  if (m.startsWith("video/") || /\.(mp4|mov|mkv|webm|avi)$/.test(n)) return "video";
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/.test(n)) return "image";
  if (m.includes("pdf") || /\.pdf$/.test(n)) return "pdf";
  if (
    m.includes("word") ||
    m.includes("officedocument.wordprocessingml") ||
    /\.(docx?|txt)$/.test(n)
  )
    return "docx";

  return "pdf";
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return Math.max(1, Math.round(bytes / 1024)) + " KB";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Penyimpanan file belum dikonfigurasi (Cloudinary)." },
      { status: 503 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Berkas tidak ditemukan dalam permintaan." },
        { status: 400 }
      );
    }

    const blob = file as Blob & { name?: string };
    const originalName = blob.name || "untitled";

    if (blob.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Ukuran berkas melebihi batas maksimum (25MB)." },
        { status: 413 }
      );
    }

    const fileType = deriveFileType(blob.type, originalName);
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let cloudinaryResourceType: "auto" | "image" | "video" | "raw" = "auto";
    if (fileType === "image") cloudinaryResourceType = "image";
    else if (fileType === "video" || fileType === "audio") cloudinaryResourceType = "video";
    else if (fileType === "pdf" || fileType === "docx") cloudinaryResourceType = "raw";

    const { url, publicId } = await uploadBuffer(
      buffer,
      `edusparq/${session.user.id}`,
      originalName,
      cloudinaryResourceType
    );

    return NextResponse.json({
      url,
      publicId,
      fileType,
      fileSize: formatSize(blob.size),
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Gagal mengunggah berkas. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
