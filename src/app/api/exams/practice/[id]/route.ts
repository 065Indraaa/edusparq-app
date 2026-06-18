import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { connectDB } from "../../../../../lib/db/mongodb";
import { PracticePaper } from "../../../../../lib/db/models/PracticePaper";

export const runtime = "nodejs";

// Spaced-repetition: next review interval (days) based on the score.
function nextIntervalDays(score: number, attempts: number): number {
  if (score >= 85) return Math.min(2 ** attempts * 4, 30); // mastered → push out
  if (score >= 70) return 3;
  if (score >= 50) return 1;
  return 1; // weak → review tomorrow
}

// PATCH /api/exams/practice/[id] — record an attempt score + schedule next review.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const score = Math.min(Math.max(Number(body?.score) || 0, 0), 100);

  await connectDB();
  const paper = await PracticePaper.findOne({ _id: params.id, userId: session.user.id });
  if (!paper)
    return NextResponse.json({ error: "Paper tidak ditemukan." }, { status: 404 });

  paper.attempts = (paper.attempts || 0) + 1;
  paper.lastScore = score;
  const days = nextIntervalDays(score, paper.attempts);
  paper.nextReviewAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  paper.updatedAt = new Date();
  await paper.save();

  return NextResponse.json({
    paper: { _id: paper._id, attempts: paper.attempts, lastScore: paper.lastScore, nextReviewAt: paper.nextReviewAt },
  });
}

// DELETE /api/exams/practice/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const res = await PracticePaper.deleteOne({ _id: params.id, userId: session.user.id });
  if (res.deletedCount === 0)
    return NextResponse.json({ error: "Paper tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ success: true });
}
