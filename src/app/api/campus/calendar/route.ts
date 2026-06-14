import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { CampusCalendar } from "@/lib/db/models/CampusCalendar";

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

  const calendars = await CampusCalendar.find({ universitas })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(calendars);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { universitas, tahunAjaran, events } = body;

  if (!universitas) {
    return NextResponse.json(
      { error: "Field 'universitas' wajib diisi." },
      { status: 400 }
    );
  }

  await connectDB();

  const calendar = await CampusCalendar.create({
    universitas,
    tahunAjaran,
    events: events ?? [],
    sumber: "crowdsource",
    verified: false,
    createdByNama: session.user.name ?? "",
  });

  return NextResponse.json(calendar, { status: 201 });
}
