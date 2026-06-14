import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Document } from "@/lib/db/models/Document";
import { DocumentChunk } from "@/lib/db/models/DocumentChunk";
import { chunkText } from "@/lib/rag";
import { extractTextFromUrl } from "@/lib/server-extract";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const doc = await Document.findOne({
    _id: params.id,
    userId: session.user.id,
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Remove old chunks before re-indexing
  await DocumentChunk.deleteMany({ documentId: doc._id, userId: session.user.id });

  const text = await extractTextFromUrl(doc.fileUrl, doc.fileType);

  if (!text) {
    return NextResponse.json({
      indexed: false,
      chunks: 0,
      reason:
        "Tidak ada teks yang bisa diekstraksi (format ini mungkin hasil scan/gambar).",
    });
  }

  const chunks = chunkText(text);
  if (chunks.length > 0) {
    await DocumentChunk.insertMany(
      chunks.map((content, chunkIndex) => ({
        userId: session.user.id,
        documentId: doc._id,
        courseName: doc.courseName,
        content,
        chunkIndex,
      }))
    );
  }

  doc.status = "indexed";
  await doc.save();

  return NextResponse.json({ indexed: true, chunks: chunks.length });
}
