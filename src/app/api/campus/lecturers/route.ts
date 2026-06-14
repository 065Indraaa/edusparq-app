import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { LecturerDatabase } from "@/lib/db/models/LecturerDatabase";
import mongoose from "mongoose";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const universitas = searchParams.get("universitas");
  const prodi = searchParams.get("prodi");
  const q = searchParams.get("q");

  const filter: Record<string, unknown> = {};
  if (universitas) filter.universitas = universitas;
  if (prodi) filter.prodi = prodi;
  if (q) {
    const regex = new RegExp(q, "i");
    filter.$or = [{ nama: regex }, { matkulDiampu: regex }];
  }

  await connectDB();

  const lecturers = await LecturerDatabase.find(filter).sort({ nama: 1 }).lean();

  return NextResponse.json(lecturers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { universitas, prodi, nama, matkulDiampu, researchInterest, kontak } = body;

  if (!nama) {
    return NextResponse.json(
      { error: "Field 'nama' wajib diisi." },
      { status: 400 }
    );
  }

  await connectDB();

  const lecturer = await LecturerDatabase.create({
    universitas,
    prodi,
    nama,
    matkulDiampu: matkulDiampu ?? [],
    researchInterest,
    kontak,
    verified: false,
    createdByNama: session.user.name ?? "",
  });

  return NextResponse.json(lecturer, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Parameter 'id' wajib diisi." },
      { status: 400 }
    );
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "ID dosen tidak valid." },
      { status: 400 }
    );
  }

  await connectDB();

  const result = await LecturerDatabase.findByIdAndDelete(id);

  if (!result) {
    return NextResponse.json(
      { error: "Data dosen tidak ditemukan." },
      { status: 404 }
    );
  }

  return NextResponse.json({ message: "Data dosen berhasil dihapus." });
}
