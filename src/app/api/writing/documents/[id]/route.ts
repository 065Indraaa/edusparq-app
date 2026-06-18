import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { connectDB } from "../../../../../lib/db/mongodb";
import { SavedDocument } from "../../../../../lib/db/models/SavedDocument";

export const runtime = "nodejs";

const stripHtml = (html: string) =>
  String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// GET /api/writing/documents/[id] — fetch one document (full content).
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const document = await SavedDocument.findOne({
    _id: params.id,
    userId: session.user.id,
  }).lean();
  if (!document)
    return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ document });
}

// PATCH /api/writing/documents/[id] — update / autosave a document.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body?.title === "string") update.title = body.title.slice(0, 200);
  if (typeof body?.content === "string") {
    update.content = body.content;
    update.wordCount = stripHtml(body.content).split(" ").filter(Boolean).length;
  }
  if (typeof body?.docType === "string") update.docType = body.docType;
  if (typeof body?.courseName === "string") update.courseName = body.courseName.slice(0, 120);
  if (typeof body?.citationStyle === "string") update.citationStyle = body.citationStyle;

  await connectDB();
  const document = await SavedDocument.findOneAndUpdate(
    { _id: params.id, userId: session.user.id },
    { $set: update },
    { new: true }
  ).lean();
  if (!document)
    return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ document });
}

// DELETE /api/writing/documents/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const res = await SavedDocument.deleteOne({
    _id: params.id,
    userId: session.user.id,
  });
  if (res.deletedCount === 0)
    return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ success: true });
}
