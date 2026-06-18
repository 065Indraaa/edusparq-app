import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { User } from "../../../../lib/db/models/User";
import { Course } from "../../../../lib/db/models/Course";
import { DefaultCourse } from "../../../../lib/db/models/DefaultCourse";

export const runtime = "nodejs";

// POST /api/courses/autofill — auto-create the user's courses from the crowdsourced
// prodi curriculum (DefaultCourse) for semesters 1..current. REAL data only: if the
// prodi has no curriculum yet, nothing is created and we say so honestly.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const user = (await User.findById(session.user.id).lean()) as
    | { prodi?: string; semester?: number }
    | null;
  const prodi = (user?.prodi || "").trim();
  const currentSem = Math.min(Math.max(Number(user?.semester) || 1, 1), 14);

  if (!prodi) {
    return NextResponse.json(
      {
        created: 0,
        message: "Isi program studi di profil dulu supaya mata kuliah bisa diisi otomatis.",
      },
      { status: 400 }
    );
  }

  const defaults = (await DefaultCourse.find({
    prodi,
    semester: { $lte: currentSem },
  })
    .sort({ semester: 1 })
    .lean()) as Array<{ namaMatkul?: string; semester?: number; sks?: number }>;

  if (defaults.length === 0) {
    return NextResponse.json({
      created: 0,
      message: `Belum ada data kurikulum untuk prodi "${prodi}". Tambahkan mata kuliahmu manual sekali — nanti otomatis jadi rujukan untuk mahasiswa prodi yang sama.`,
    });
  }

  const existing = (await Course.find({ userId: session.user.id })
    .select("name")
    .lean()) as Array<{ name?: string }>;
  const have = new Set(existing.map((c) => (c.name || "").trim().toLowerCase()));

  const toCreate: Array<{ userId: string; name: string; semester: string; credits: number }> = [];
  for (const d of defaults) {
    const name = (d.namaMatkul || "").trim();
    if (!name || have.has(name.toLowerCase())) continue;
    have.add(name.toLowerCase());
    toCreate.push({
      userId: session.user.id,
      name,
      semester: `Semester ${d.semester ?? 1}`,
      credits: typeof d.sks === "number" ? d.sks : 3,
    });
  }

  if (toCreate.length === 0) {
    return NextResponse.json({
      created: 0,
      message: "Semua mata kuliah dari kurikulum prodi sudah ada di daftarmu.",
    });
  }

  await Course.insertMany(toCreate);
  return NextResponse.json({
    created: toCreate.length,
    message: `${toCreate.length} mata kuliah ditambahkan dari kurikulum prodi (semester 1–${currentSem}). Tinggal unggah materinya per mata kuliah.`,
  });
}
