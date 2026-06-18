import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { connectDB } from "../../../lib/db/mongodb";
import { ChatMessage } from "../../../lib/db/models/ChatMessage";
import { Document } from "../../../lib/db/models/Document";
import { Deadline } from "../../../lib/db/models/Deadline";
import { Flashcard } from "../../../lib/db/models/Flashcard";
import { Citation } from "../../../lib/db/models/Citation";
import { Course } from "../../../lib/db/models/Course";

// Safe empty payload returned on any DB error so the page never gets a 500.
function emptyPayload() {
  const days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  return {
    totals: { chats: 0, documents: 0, deadlines: 0, flashcards: 0, citations: 0, courses: 0 },
    deadlinesByStatus: { pending: 0, done: 0, overdue: 0 },
    chatsByMode: { socratic: 0, helper: 0, research: 0 },
    recentActivityDays: days,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    await connectDB();

    // Window for the last 7 days (today inclusive), normalized to midnight.
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    const [
      chats,
      documents,
      deadlines,
      flashcards,
      citations,
      courses,
      deadlineStatusAgg,
      chatModeAgg,
      activityAgg,
    ] = await Promise.all([
      ChatMessage.countDocuments({ userId, role: "user" }),
      Document.countDocuments({ userId }),
      Deadline.countDocuments({ userId }),
      Flashcard.countDocuments({ userId }),
      Citation.countDocuments({ userId }),
      Course.countDocuments({ userId }),
      Deadline.aggregate([
        { $match: { userId: session.user.id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      ChatMessage.aggregate([
        { $match: { userId: session.user.id, role: "user" } },
        { $group: { _id: "$mode", count: { $sum: 1 } } },
      ]),
      ChatMessage.aggregate([
        { $match: { userId: session.user.id, createdAt: { $gte: start } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const deadlinesByStatus = { pending: 0, done: 0, overdue: 0 };
    for (const row of deadlineStatusAgg as { _id: string; count: number }[]) {
      if (row._id && row._id in deadlinesByStatus) {
        deadlinesByStatus[row._id as keyof typeof deadlinesByStatus] = row.count;
      }
    }

    const chatsByMode = { socratic: 0, helper: 0, research: 0 };
    for (const row of chatModeAgg as { _id: string; count: number }[]) {
      if (row._id && row._id in chatsByMode) {
        chatsByMode[row._id as keyof typeof chatsByMode] = row.count;
      }
    }

    // Build a continuous 7-day series so the chart always has 7 points.
    const counts = new Map<string, number>();
    for (const row of activityAgg as { _id: string; count: number }[]) {
      counts.set(row._id, row.count);
    }
    const recentActivityDays: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      recentActivityDays.push({ date: key, count: counts.get(key) ?? 0 });
    }

    return NextResponse.json({
      totals: { chats, documents, deadlines, flashcards, citations, courses },
      deadlinesByStatus,
      chatsByMode,
      recentActivityDays,
    });
  } catch {
    // Never surface a 500 — degrade to a zeroed but valid payload.
    return NextResponse.json(emptyPayload());
  }
}
