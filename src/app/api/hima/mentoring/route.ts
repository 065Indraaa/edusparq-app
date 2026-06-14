export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { MentoringSession } from "@/lib/db/models/MentoringSession";
import { requireMembership } from "@/lib/hima";
import { Types } from "mongoose";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId diperlukan." }, { status: 400 });

  const member = await requireMembership(orgId, session.user.id);
  if (!member) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const items = await MentoringSession.find({ orgId }).sort({ createdAt: -1 }).lean();
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const body = await req.json();
  const { orgId, mentorNama, menteeNama, courseName, jadwal, catatan } = body;

  if (!orgId) return NextResponse.json({ error: "orgId wajib diisi." }, { status: 400 });

  const member = await requireMembership(orgId, session.user.id);
  if (!member) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const item = await MentoringSession.create({
    orgId,
    mentorId: new Types.ObjectId(session.user.id),
    mentorNama: mentorNama || session.user.name || "",
    menteeNama,
    courseName,
    jadwal,
    catatan,
  });
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id diperlukan." }, { status: 400 });

  const body = await req.json();
  const existing = (await MentoringSession.findById(id).lean()) as { orgId: unknown } | null;
  if (!existing) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });

  const member = await requireMembership(String(existing.orgId), session.user.id);
  if (!member) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const updated = await MentoringSession.findByIdAndUpdate(id, body, { new: true }).lean();
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id diperlukan." }, { status: 400 });

  const existing = (await MentoringSession.findById(id).lean()) as { orgId: unknown } | null;
  if (!existing) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });

  const member = await requireMembership(String(existing.orgId), session.user.id);
  if (!member) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  await MentoringSession.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
