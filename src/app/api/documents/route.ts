import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { connectDB } from "../../../lib/db/mongodb";
import { Document } from "../../../lib/db/models/Document";
import { DocumentChunk } from "../../../lib/db/models/DocumentChunk";
import { chunkText, getEmbedding } from "../../../lib/rag";
import { z } from "zod";
import { extractTextFromUrl } from "../../../lib/server-extract";

export const runtime = "nodejs";
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
    status: "indexed",
    uploadedAt: new Date(),
  });

  // Helper function to process chunks and generate vector embeddings
  async function processAndSaveChunks(rawText: string) {
    const chunks = chunkText(rawText);
    if (chunks.length === 0) return;

    // Generate embeddings for each chunk in parallel safely
    const chunksWithEmbeddings = await Promise.all(
      chunks.map(async (content, chunkIndex) => {
        try {
          const embedding = await getEmbedding(content);
          return {
            userId: session!.user.id,
            documentId: doc._id,
            courseName,
            content,
            chunkIndex,
            embedding: embedding || [],
          };
        } catch (err) {
          console.error(`[documents/route] Failed to embed chunk ${chunkIndex}:`, err);
          return {
            userId: session!.user.id,
            documentId: doc._id,
            courseName,
            content,
            chunkIndex,
            embedding: [],
          };
        }
      })
    );

    await DocumentChunk.insertMany(chunksWithEmbeddings);
  }

  if (typeof textContent === "string" && textContent.trim().length > 0) {
    await processAndSaveChunks(textContent);
  } else if (fileType === "pdf" || fileType === "docx") {
    try {
      const extracted = await extractTextFromUrl(fileUrl, fileType);
      if (extracted.length > 0) {
        await processAndSaveChunks(extracted);
      }
    } catch (err) {
      console.error("[documents/route] server extraction error:", err);
    }
  }

  return NextResponse.json(doc, { status: 201 });
}
