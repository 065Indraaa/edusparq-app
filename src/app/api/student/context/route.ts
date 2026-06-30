import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { getStudentContext } from "../../../../lib/student-profile";
import { ClassSchedule } from "../../../../lib/db/models/ClassSchedule";
import { UsageLog } from "../../../../lib/db/models/UsageLog";
import { getTodayHari } from "../../../../lib/date-helpers";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  try {
    await connectDB();

    const [context, todaySchedule, recentActivity] = await Promise.all([
      getStudentContext(userId),
      ClassSchedule.find({ userId, hari: getTodayHari() })
        .sort({ jamMulai: 1 })
        .lean(),
      UsageLog.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    return NextResponse.json({
      ...context,
      todaySchedule,
      recentActivity,
    });
  } catch (err) {
    console.error("[api/student/context] error:", err);
    return NextResponse.json({ error: "Failed to get student context" }, { status: 500 });
  }
}
