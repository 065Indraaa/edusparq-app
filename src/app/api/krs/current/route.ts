import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { KRS } from "../../../../lib/db/models/KRS";

/**
 * GET /api/krs/current
 *
 * Returns the user's current active KRS (status="active"). If more than one
 * is somehow active, the most recently updated one wins. A 200 with `null` is
 * returned when the student has not imported a KRS yet.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const krs = await KRS.findOne({ userId: session.user.id, status: "active" })
    .sort({ updatedAt: -1 })
    .lean();

  if (!krs) {
    return NextResponse.json({ krs: null });
  }

  return NextResponse.json({
    krs: {
      id: String(krs._id),
      academicYear: krs.academicYear,
      semester: krs.semester,
      status: krs.status,
      courses: (krs.courses ?? []).map((c: any) => ({
        courseId: c.courseId ? String(c.courseId) : null,
        courseName: c.courseName ?? "",
        sks: Number(c.sks) ?? 0,
        lecturer: c.lecturer ?? "",
        schedule: c.schedule ?? "",
      })),
      totalSks: (krs.courses ?? []).reduce(
        (sum: number, c: any) => sum + (Number(c.sks) || 0),
        0
      ),
      updatedAt: krs.updatedAt,
    },
  });
}
