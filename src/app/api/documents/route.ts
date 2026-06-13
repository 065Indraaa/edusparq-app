import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Document } from "@/lib/db/models/Document";
import { DocumentChunk } from "@/lib/db/models/DocumentChunk";
import { chunkText } from "@/lib/rag";
import { z } from "zod";

const CreateSchema = z.object({
  courseName: z.string().min(1),
  originalName: z.string().min(1),
  fileUrl: z.string().min(1),
  publicId: z.string().optional(),
  fileType: z.enum(["pdf", "docx", "audio", "video", "image"]),
  fileSize: z.string().optional(),
  textContent: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const docs = await Document.find({ userId: session.user.id }).sort({
    uploadedAt: -1,
  });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    courseName,
    originalName,
    fileUrl,
    publicId,
    fileType,
    fileSize,
    textContent,
  } = parsed.data;

  await connectDB();

  const doc = await Document.create({
    userId: session.user.id,
    courseName,
    filename: originalName,
    originalName,
    fileUrl,
    publicId: publicId || "",
    fileType,
    fileSize: fileSize || "",
    // NOTE: real PDF/audio binary text extraction is out of scope. Chunks are
    // only created when the client provides extracted textContent.
    // TODO: server-side text extraction (pdf-parse / Whisper / OCR).
    status: "indexed",
    uploadedAt: new Date(),
  });

  if (typeof textContent === "string" && textContent.trim().length > 0) {
    const chunks = chunkText(textContent);
    if (chunks.length > 0) {
      await DocumentChunk.insertMany(
        chunks.map((content, chunkIndex) => ({
          userId: session.user.id,
          documentId: doc._id,
          courseName,
          content,
          chunkIndex,
        }))
      );
    }
  }

  return NextResponse.json(doc, { status: 201 });
}
