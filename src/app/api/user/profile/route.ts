import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { User } from "../../../../lib/db/models/User";
import { Deadline } from "../../../../lib/db/models/Deadline";
import { Course } from "../../../../lib/db/models/Course";
import { Document } from "../../../../lib/db/models/Document";
import { computeIpk, totalSks } from "../../../../lib/gpa";

// GET /api/user/profile - get current user profile + summary stats
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const [user, deadlineCount, courses, documentCount] = await Promise.all([
    User.findById(session.user.id).lean(),
    Deadline.countDocuments({ userId: session.user.id, status: "pending" }),
    Course.find({ userId: session.user.id }).select("credits grade").lean(),
    Document.countDocuments({ userId: session.user.id, status: "indexed" }),
  ]);

  // IPK & SKS are derived from the user's real courses — never fabricated.
  // ipk is null until at least one graded course with credits exists.
  const courseList = courses as { credits?: number; grade?: string }[];
  const ipk = computeIpk(courseList);
  const sks = totalSks(courseList);

  return NextResponse.json({
    user,
    stats: {
      deadlineCount,
      courseCount: courseList.length,
      documentCount,
      ipk,        // number | null
      sks,        // total credits across all courses
    },
  });
}

// PATCH /api/user/profile - update profile
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed = ["name", "universitas", "fakultas", "prodi", "semester"];
  const update = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );

  await connectDB();
  const user = await User.findByIdAndUpdate(session.user.id, { $set: update }, { new: true });
  return NextResponse.json(user);
}
