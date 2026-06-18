import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { connectDB } from "../../../../../lib/db/mongodb";
import { Deadline } from "../../../../../lib/db/models/Deadline";
import { getValidAccessToken, createCalendarEvent } from "../../../../../lib/google";

export const runtime = "nodejs";

// POST /api/google/calendar/sync — push the user's pending deadlines that are
// not yet on Google Calendar. Returns how many were synced.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const token = await getValidAccessToken(session.user.id);
  if (!token) {
    return NextResponse.json(
      { error: "Akun Google belum terhubung atau sesi kedaluwarsa. Hubungkan ulang." },
      { status: 400 }
    );
  }

  const deadlines = (await Deadline.find({
    userId: session.user.id,
    status: "pending",
  }).lean()) as Array<{
    _id: unknown;
    title?: string;
    courseName?: string;
    description?: string;
    dueDate?: string;
    dueTime?: string;
    googleCalendarEventId?: string;
  }>;

  let synced = 0;
  for (const d of deadlines) {
    if (d.googleCalendarEventId || !d.dueDate) continue;
    const eventId = await createCalendarEvent(token, {
      summary: `${d.title || "Tugas"} — ${d.courseName || ""}`.trim(),
      description: d.description || "Dibuat dari EduSparq.",
      date: d.dueDate,
      time: d.dueTime,
    });
    if (eventId) {
      await Deadline.findByIdAndUpdate(d._id, {
        $set: { googleCalendarEventId: eventId },
      });
      synced++;
    }
  }

  return NextResponse.json({ synced });
}
