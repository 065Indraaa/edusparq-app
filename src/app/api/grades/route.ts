import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { connectDB } from "../../../lib/db/mongodb";
import { Grade } from "../../../lib/db/models/Grade";

export const runtime = "nodejs";

const VALID_GRADES = ["A", "AB", "B", "BC", "C", "D", "E"];
const GRADE_POINTS: Record<string, number> = {
  A: 4.0, AB: 3.5, B: 3.0, BC: 2.5, C: 2.0, D: 1.0, E: 0.0,
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const grades = await Grade.find({ userId: session.user.id }).sort({ semester: -1, createdAt: -1 }).lean();
  return NextResponse.json(grades);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { courseId, courseName, gradeLetter, sks, semester } = body;

  if (!courseName || !gradeLetter || !sks || !semester) {
    return NextResponse.json({ error: "courseName, gradeLetter, sks, semester required" }, { status: 400 });
  }

  const letter = String(gradeLetter).toUpperCase();
  if (!VALID_GRADES.includes(letter)) {
    return NextResponse.json({ error: `Invalid grade. Must be one of: ${VALID_GRADES.join(", ")}` }, { status: 400 });
  }

  await connectDB();
  const grade = await Grade.create({
    userId: session.user.id,
    courseId: courseId || "",
    courseName,
    gradeLetter: letter,
    gradePoint: GRADE_POINTS[letter],
    sks: Number(sks),
    semester,
  });

  return NextResponse.json(grade, { status: 201 });
}
