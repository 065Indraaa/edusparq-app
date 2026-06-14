export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { OrganizationSection } from "@/lib/db/models/OrganizationSection";
import { requireMembership } from "@/lib/hima";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId diperlukan." }, { status: 400 });

  const member = await requireMembership(orgId, session.user.id);
  if (!member) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const sections = await OrganizationSection.find({ orgId }).lean();
  return NextResponse.json(sections);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const body = await req.json();
  const { orgId, nama, deskripsi } = body;

  if (!orgId || !nama?.trim())
    return NextResponse.json({ error: "orgId dan nama wajib diisi." }, { status: 400 });

  const member = await requireMembership(orgId, session.user.id);
  if (!member) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const section = await OrganizationSection.create({ orgId, nama: nama.trim(), deskripsi });
  return NextResponse.json(section, { status: 201 });
}
