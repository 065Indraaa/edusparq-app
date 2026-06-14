import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { CollabReview, CollabGroup } from "@/lib/db/models/Collab";

export const runtime = "nodejs";

// GET /api/collab/reviews?groupId=... — list reviews for a group.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId") || "";

  await connectDB();
  const group = await CollabGroup.findOne({ _id: groupId, "members.userId": session.user.id });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reviews = await CollabReview.find({ groupId: group._id }).sort({ createdAt: -1 }).lean();
  return NextResponse.json(reviews);
}

// POST /api/collab/reviews — add a review/comment on a task.
//   body: { groupId, taskId?, komentar, rating? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const groupId = String(body?.groupId || "");

  await connectDB();
  const group = await CollabGroup.findOne({ _id: groupId, "members.userId": session.user.id });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const review = await CollabReview.create({
    groupId: group._id,
    ...(body?.taskId ? { taskId: body.taskId } : {}),
    reviewerId: session.user.id,
    reviewerNama: session.user.name || "Anggota",
    komentar: String(body?.komentar || "").trim(),
    rating: typeof body?.rating === "number" ? body.rating : 5,
  });

  return NextResponse.json(review, { status: 201 });
}
