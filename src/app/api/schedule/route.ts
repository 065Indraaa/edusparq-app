import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { connectDB } from "../../../lib/db/mongodb";
import { ClassSchedule } from "../../../lib/db/models/ClassSchedule";

export const runtime = "nodejs";

// GET /api/schedule — the user's weekly class schedule, sorted by day then time.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const items = await ClassSchedule.find({ userId: session.user.id })
    .sort({ hari: 1, jamMulai: 1 })
    .lean();
  return NextResponse.json({ items });
}

// POST /api/schedule — add a class session.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const courseName = String(body?.courseName || "").trim();
  const hari = Number(body?.hari);
  if (!courseName || !Number.isInteger(hari) || hari < 1 || hari > 7) {
    return NextResponse.json({ error: "Mata kuliah dan hari wajib diisi." }, { status: 400 });
  }

  await connectDB();
  const item = await ClassSchedule.create({
    userId: session.user.id,
    courseName,
    hari,
    jamMulai: String(body?.jamMulai || "08:00"),
    jamSelesai: String(body?.jamSelesai || "09:40"),
    ruang: String(body?.ruang || "").trim(),
    dosen: String(body?.dosen || "").trim(),
  });
  return NextResponse.json({ item }, { status: 201 });
}

// DELETE /api/schedule?id=...
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await connectDB();
  await ClassSchedule.deleteOne({ _id: id, userId: session.user.id });
  return NextResponse.json({ success: true });
}
