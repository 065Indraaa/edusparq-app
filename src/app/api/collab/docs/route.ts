import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { CollabDocLink, CollabGroup } from "@/lib/db/models/Collab";

export const runtime = "nodejs";

// GET /api/collab/docs?groupId=... — list doc links for a group.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId") || "";

  await connectDB();
  const group = await CollabGroup.findOne({ _id: groupId, "members.userId": session.user.id });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const docs = await CollabDocLink.find({ groupId: group._id }).sort({ createdAt: -1 }).lean();
  return NextResponse.json(docs);
}

// POST /api/collab/docs — add a Google Doc link.
//   body: { groupId, judul, googleDocUrl }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const groupId = String(body?.groupId || "");
  const judul = String(body?.judul || "").trim();
  const googleDocUrl = String(body?.googleDocUrl || "").trim();

  if (!judul) return NextResponse.json({ error: "Judul wajib diisi." }, { status: 400 });
  if (!googleDocUrl) return NextResponse.json({ error: "URL Google Docs wajib diisi." }, { status: 400 });

  await connectDB();
  const group = await CollabGroup.findOne({ _id: groupId, "members.userId": session.user.id });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = await CollabDocLink.create({
    groupId: group._id,
    judul,
    googleDocUrl,
    createdByNama: session.user.name || "Anggota",
  });

  return NextResponse.json(doc, { status: 201 });
}

// DELETE /api/collab/docs?id=... — remove a doc link.
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "";

  await connectDB();
  const docLink = await CollabDocLink.findById(id).lean() as { groupId: unknown } | null;
  if (!docLink) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });

  const isMember = await CollabGroup.exists({ _id: docLink.groupId, "members.userId": session.user.id });
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await CollabDocLink.deleteOne({ _id: id });
  return NextResponse.json({ success: true });
}
