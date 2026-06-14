import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { CampusGuideline } from "@/lib/db/models/CampusGuideline";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const universitas = searchParams.get("universitas");

  if (!universitas) {
    return NextResponse.json(
      { error: "Parameter 'universitas' wajib diisi." },
      { status: 400 }
    );
  }

  await connectDB();

  const guideline = (await CampusGuideline.findOne({ universitas })
    .sort({ createdAt: -1 })
    .lean()) as typeof CampusGuideline.prototype | null;

  return NextResponse.json(guideline ?? null);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    universitas,
    margin,
    spasi,
    font,
    ukuranFont,
    formatHeading,
    formatDaftarPustaka,
    rules,
  } = body;

  if (!universitas) {
    return NextResponse.json(
      { error: "Field 'universitas' wajib diisi." },
      { status: 400 }
    );
  }

  await connectDB();

  const guideline = await CampusGuideline.create({
    universitas,
    margin,
    spasi,
    font,
    ukuranFont,
    formatHeading,
    formatDaftarPustaka,
    rules: rules ?? [],
    verified: false,
    createdByNama: session.user.name ?? "",
  });

  return NextResponse.json(guideline, { status: 201 });
}
