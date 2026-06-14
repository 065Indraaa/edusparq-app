import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Deadline } from "@/lib/db/models/Deadline";

export const runtime = "nodejs";

// GET /api/notifications — upcoming & overdue tugas turned into reminders.
// Window: overdue (up to 30 days back) + anything due within the next 7 days.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const raw = (await Deadline.find({ userId: session.user.id, status: "pending" })
    .lean()) as Array<{ _id: unknown; title?: string; courseName?: string; dueDate?: string; dueTime?: string }>;

  const now = new Date();
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const DAY = 86400000;

  const items = raw
    .filter((d) => d?.dueDate)
    .map((d) => {
      const due = new Date(d.dueDate as string);
      const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
      const daysLeft = Math.round((dueDay - startOfToday) / DAY);
      let severity: "overdue" | "today" | "soon" = "soon";
      if (daysLeft < 0) severity = "overdue";
      else if (daysLeft === 0) severity = "today";
      return {
        id: String(d._id),
        title: d.title || "Tugas",
        courseName: d.courseName || "",
        dueDate: d.dueDate as string,
        dueTime: d.dueTime || "23:59",
        daysLeft,
        severity,
      };
    })
    .filter((d) => d.daysLeft <= 7 && d.daysLeft >= -30)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return NextResponse.json({ items, count: items.length });
}
