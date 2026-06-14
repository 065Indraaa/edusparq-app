import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { CollabConflict, CollabGroup } from "@/lib/db/models/Collab";

export const runtime = "nodejs";

// GET /api/collab/conflicts?groupId=... — list conflicts for a group.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId") || "";

  await connectDB();
  const group = await CollabGroup.findOne({ _id: groupId, "members.userId": session.user.id });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const conflicts = await CollabConflict.find({ groupId: group._id }).sort({ createdAt: -1 }).lean();
  return NextResponse.json(conflicts);
}

// POST /api/collab/conflicts — report a new conflict/issue.
//   body: { groupId, isu }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const groupId = String(body?.groupId || "");
  const isu = String(body?.isu || "").trim();

  if (!isu) return NextResponse.json({ error: "Isu wajib diisi." }, { status: 400 });

  await connectDB();
  const group = await CollabGroup.findOne({ _id: groupId, "members.userId": session.user.id });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const conflict = await CollabConflict.create({
    groupId: group._id,
    isu,
    dibuatNama: session.user.name || "Anggota",
  });

  return NextResponse.json(conflict, { status: 201 });
}

// PATCH /api/collab/conflicts?id=... — update status.
//   body: { status: "terbuka" | "diskusi" | "selesai" }
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "";

  const body = await req.json().catch(() => ({}));

  await connectDB();

  const conflict = await CollabConflict.findById(id).lean() as { groupId: unknown } | null;
  if (!conflict) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });

  const isMember = await CollabGroup.exists({ _id: conflict.groupId, "members.userId": session.user.id });
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const allowedStatus = ["terbuka", "diskusi", "selesai"];
  if (!body?.status || !allowedStatus.includes(body.status)) {
    return NextResponse.json({ error: "Status tidak valid." }, { status: 400 });
  }

  const updated = await CollabConflict.findByIdAndUpdate(
    id,
    { $set: { status: body.status } },
    { new: true }
  );

  return NextResponse.json(updated);
}
