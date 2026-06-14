import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Course } from "@/lib/db/models/Course";
import { User } from "@/lib/db/models/User";
import { DefaultCourse } from "@/lib/db/models/DefaultCourse";
import { courseSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const courses = await Course.find({ userId: session.user.id }).sort({ createdAt: -1 });
  return NextResponse.json(courses);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await connectDB();
  const course = await Course.create({ userId: session.user.id, ...parsed.data });

  // Crowdsource: contribute this course to the prodi curriculum (DefaultCourse) so
  // other students of the same prodi get it as a suggestion / auto-fill. Best-effort.
  try {
    const u = (await User.findById(session.user.id).select("prodi").lean()) as { prodi?: string } | null;
    const prodi = (u?.prodi || "").trim();
    const semNum = parseInt(String(parsed.data.semester).replace(/\D/g, ""), 10);
    if (prodi && course?.name && Number.isFinite(semNum)) {
      await DefaultCourse.findOneAndUpdate(
        { prodi, semester: semNum, namaMatkul: course.name },
        {
          $setOnInsert: { prodi, semester: semNum, namaMatkul: course.name, sks: course.credits ?? 3 },
          $inc: { jumlahKontributor: 1 },
        },
        { upsert: true }
      );
    }
  } catch {
    // ignore crowdsource errors — never block the user's own course creation
  }
  return NextResponse.json(course, { status: 201 });
}
