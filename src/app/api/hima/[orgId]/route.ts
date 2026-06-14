export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Organization } from "@/lib/db/models/Organization";
import { OrganizationMember } from "@/lib/db/models/OrganizationMember";
import { OrganizationSection } from "@/lib/db/models/OrganizationSection";
import { requireMembership } from "@/lib/hima";

export async function GET(
  _req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const { orgId } = params;
  const userId = session.user.id;

  const member = await requireMembership(orgId, userId);
  if (!member) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const org = await Organization.findById(orgId).lean();
  if (!org) return NextResponse.json({ error: "Organisasi tidak ditemukan." }, { status: 404 });

  const members = await OrganizationMember.find({ orgId, status: "active" }).lean();
  const sections = await OrganizationSection.find({ orgId }).lean();

  return NextResponse.json({ org, members, sections });
}
