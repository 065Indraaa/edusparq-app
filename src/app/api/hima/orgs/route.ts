export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Organization } from "@/lib/db/models/Organization";
import { OrganizationMember } from "@/lib/db/models/OrganizationMember";
import { generateJoinCode } from "@/lib/hima";
import { Types } from "mongoose";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const userId = session.user.id;

  // Find all memberships for this user
  const memberships = (await OrganizationMember.find({
    userId,
    status: "active",
  }).lean()) as Array<{ orgId: unknown }>;

  if (!memberships.length) return NextResponse.json([]);

  const orgIds = memberships.map((m) => m.orgId);
  const orgs = await Organization.find({ _id: { $in: orgIds } }).lean();
  return NextResponse.json(orgs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const userId = session.user.id;
  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const { nama, prodi, fakultas, universitas, visi, misi } = body;
    if (!nama?.trim()) return NextResponse.json({ error: "Nama organisasi wajib diisi." }, { status: 400 });

    // Generate a unique join code
    let joinCode = generateJoinCode();
    let attempts = 0;
    while (attempts < 10) {
      const exists = await Organization.findOne({ joinCode }).lean();
      if (!exists) break;
      joinCode = generateJoinCode();
      attempts++;
    }

    const org = await Organization.create({
      ownerId: new Types.ObjectId(userId),
      nama: nama.trim(),
      prodi,
      fakultas,
      universitas,
      visi,
      misi,
      joinCode,
    });

    // Create founder membership
    await OrganizationMember.create({
      orgId: org._id,
      userId: new Types.ObjectId(userId),
      nama: session.user.name || "",
      role: "ketua",
      status: "active",
    });

    return NextResponse.json(org, { status: 201 });
  }

  if (action === "join") {
    const { joinCode } = body;
    if (!joinCode?.trim()) return NextResponse.json({ error: "Kode join wajib diisi." }, { status: 400 });

    const org = (await Organization.findOne({ joinCode: joinCode.trim().toUpperCase() }).lean()) as {
      _id: unknown;
    } | null;
    if (!org) return NextResponse.json({ error: "Kode tidak ditemukan." }, { status: 404 });

    // Idempotent: check if already a member
    const existing = await OrganizationMember.findOne({ orgId: org._id, userId }).lean();
    if (!existing) {
      await OrganizationMember.create({
        orgId: org._id,
        userId: new Types.ObjectId(userId),
        nama: session.user.name || "",
        role: "anggota",
        status: "active",
      });
    }

    return NextResponse.json(org);
  }

  return NextResponse.json({ error: "Action tidak dikenal." }, { status: 400 });
}
