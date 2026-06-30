import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { connectDB } from "../../../lib/db/mongodb";
import { complete } from "../../../lib/ai-client";
import { Deadline } from "../../../lib/db/models/Deadline";
import { ClassSchedule } from "../../../lib/db/models/ClassSchedule";
import { KRS } from "../../../lib/db/models/KRS";
import { User } from "../../../lib/db/models/User";
import {
  buildWorkspaceSystemPrompt,
  type DeadlineContext,
  type ScheduleItemContext,
  type CourseContext,
} from "../../../lib/workspace-chat-prompt";
import { getTodayHari, todayStr, daysUntil } from "../../../lib/date-helpers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message || "").trim();
  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const userId = session.user.id;

  try {
    await connectDB();

    const [user, deadlinesRaw, todayScheduleRaw, activeKrs] = await Promise.all([
      User.findById(userId).select("name").lean() as Promise<{ name?: string } | null>,
      Deadline.find({
        userId,
        status: "pending",
        dueDate: { $gte: todayStr() },
      })
        .sort({ dueDate: 1 })
        .limit(5)
        .lean() as Promise<
        Array<{
          title?: string;
          courseName?: string;
          dueDate?: string;
          dueTime?: string;
        }>
      >,
      ClassSchedule.find({ userId, hari: getTodayHari() })
        .sort({ jamMulai: 1 })
        .lean() as Promise<
        Array<{
          courseName?: string;
          jamMulai?: string;
          jamSelesai?: string;
          ruang?: string;
          dosen?: string;
        }>
      >,
      KRS.findOne({ userId, status: "active" })
        .sort({ updatedAt: -1 })
        .lean() as Promise<{
        courses?: Array<{
          courseName?: string;
          sks?: number;
          lecturer?: string;
        }>;
      } | null>,
    ]);

    const deadlines: DeadlineContext[] = deadlinesRaw.map((d) => ({
      title: d.title || "",
      courseName: d.courseName || "",
      dueDate: d.dueDate || "",
      dueTime: d.dueTime || "23:59",
      daysLeft: daysUntil(d.dueDate || ""),
    }));

    const todaySchedule: ScheduleItemContext[] = todayScheduleRaw.map((s) => ({
      courseName: s.courseName || "",
      jamMulai: s.jamMulai || "",
      jamSelesai: s.jamSelesai || "",
      ruang: s.ruang || "",
      dosen: s.dosen || "",
    }));

    const courses: CourseContext[] = (activeKrs?.courses ?? []).map((c) => ({
      name: c.courseName || "",
      sks: Number(c.sks) || 0,
      lecturer: c.lecturer || "",
    }));

    const systemPrompt = buildWorkspaceSystemPrompt({
      userName: user?.name || undefined,
      deadlines,
      todaySchedule,
      courses,
    });

    const result = await complete(
      {
        feature: "chat",
        system: systemPrompt,
        user: message,
        temperature: 0.4,
        maxTokens: 1024,
      },
      userId
    );

    return NextResponse.json({ reply: result.text });
  } catch (err) {
    console.error("[api/workspace-chat] error:", err);
    const errorMessage = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
