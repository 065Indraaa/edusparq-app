import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { connectDB } from "../../../../../lib/db/mongodb";
import { Document } from "../../../../../lib/db/models/Document";
import { DocumentChunk } from "../../../../../lib/db/models/DocumentChunk";

// GET /api/documents/[id]/chunks - real indexed chunks for a document, used by
// the workspace "indexing inspector" so the preview reflects actual RAG content
// instead of mock samples.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  // Confirm the document belongs to the user before exposing its chunks.
  const doc = await Document.findOne({ _id: params.id, userId: session.user.id }).select("_id").lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const chunks = await DocumentChunk.find({
    documentId: params.id,
    userId: session.user.id,
  })
    .sort({ chunkIndex: 1 })
    .limit(50)
    .select("content chunkIndex courseName")
    .lean();

  return NextResponse.json(chunks);
}
