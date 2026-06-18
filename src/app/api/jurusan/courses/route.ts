import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models/User";
import { matchJurusan } from "@/lib/jurusan-catalog";

/**
 * GET /api/jurusan/courses?semester=3
 *
 * Rekomendasi mata kuliah populer untuk prodi user yang sedang login,
 * berdasarkan katalog jurusan EduSparq.
 *
 * Query params:
 *   - semester: filter hanya matkul untuk semester tertentu
 *
 * Response:
 *   {
 *     matched: boolean,           // true jika prodi user cocok dengan katalog
 *     jurusanName: string | null,
 *     fakultasName: string | null,
 *     courses: [{ semester, namaMatkul, sks }]
 *   }
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(session.user.id).select("prodi semester").lean();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const filterSemester = searchParams.get("semester");

  const jurusan = matchJurusan(user.prodi || "");
  if (!jurusan) {
    return NextResponse.json({
      matched: false,
      jurusanName: null,
      fakultasName: null,
      courses: [],
    });
  }

  let courses = jurusan.popularCourses || [];

  // Optional filter by semester
  if (filterSemester) {
    const sem = parseInt(filterSemester, 10);
    if (!isNaN(sem)) {
      courses = courses.filter(([s]) => s === sem);
    }
  }

  return NextResponse.json({
    matched: true,
    jurusanName: jurusan.name,
    fakultasName: jurusan.fakultasName,
    icon: jurusan.icon,
    description: jurusan.description,
    courses: courses.map(([semester, namaMatkul, sks]) => ({
      semester,
      namaMatkul,
      sks,
    })),
    userSemester: user.semester,
  });
}
