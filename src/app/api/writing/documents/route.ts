import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { SavedDocument } from "../../../../lib/db/models/SavedDocument";

export const runtime = "nodejs";

const stripHtml = (html: string) =>
  String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// GET /api/writing/documents — list the user's saved documents (newest first).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const documents = await SavedDocument.find({ userId: session.user.id })
    .sort({ updatedAt: -1 })
    .select("title docType courseName citationStyle wordCount updatedAt createdAt")
    .lean();
  return NextResponse.json({ documents });
}

// POST /api/writing/documents — create a new document.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const content = String(body?.content || "");
  await connectDB();

  const doc = await SavedDocument.create({
    userId: session.user.id,
    title: String(body?.title || "Dokumen Tanpa Judul").slice(0, 200),
    content,
    docType: String(body?.docType || "makalah"),
    courseName: String(body?.courseName || "").slice(0, 120),
    citationStyle: String(body?.citationStyle || "APA"),
    wordCount: stripHtml(content).split(" ").filter(Boolean).length,
  });

  return NextResponse.json({ document: doc });
}
