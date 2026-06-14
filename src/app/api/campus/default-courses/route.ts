import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { DefaultCourse } from "@/lib/db/models/DefaultCourse";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const prodi = searchParams.get("prodi");
  const semesterRaw = searchParams.get("semester");

  if (!prodi) {
    return NextResponse.json(
      { error: "Parameter 'prodi' wajib diisi." },
      { status: 400 }
    );
  }

  const filter: Record<string, unknown> = { prodi };
  if (semesterRaw !== null) {
    const semester = parseInt(semesterRaw, 10);
    if (!isNaN(semester)) filter.semester = semester;
  }

  await connectDB();

  const courses = await DefaultCourse.find(filter).sort({ semester: 1, namaMatkul: 1 }).lean();

  return NextResponse.json(courses);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { prodi, semester, namaMatkul, sks } = body;

  if (!prodi) {
    return NextResponse.json(
      { error: "Field 'prodi' wajib diisi." },
      { status: 400 }
    );
  }
  if (!namaMatkul) {
    return NextResponse.json(
      { error: "Field 'namaMatkul' wajib diisi." },
      { status: 400 }
    );
  }

  await connectDB();

  const existing = await DefaultCourse.findOne({ prodi, semester, namaMatkul });

  if (existing) {
    existing.jumlahKontributor = (existing.jumlahKontributor ?? 1) + 1;
    if (sks !== undefined) existing.sks = sks;
    await existing.save();
    return NextResponse.json(existing, { status: 200 });
  }

  const course = await DefaultCourse.create({
    prodi,
    semester,
    namaMatkul,
    sks: sks ?? 3,
    jumlahKontributor: 1,
  });

  return NextResponse.json(course, { status: 201 });
}
