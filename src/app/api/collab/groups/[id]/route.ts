import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { CollabTask, CollabDoc, CollabPoll } from "@/lib/db/models/Collab";
import { getMemberGroup } from "@/lib/collab";

// GET /api/collab/groups/[id] - full state (group, tasks, doc, poll) for a member.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const group = await getMemberGroup(params.id, session.user.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [tasks, doc, poll] = await Promise.all([
    CollabTask.find({ groupId: group._id }).sort({ createdAt: 1 }).lean(),
    CollabDoc.findOne({ groupId: group._id }).lean(),
    CollabPoll.findOne({ groupId: group._id }).sort({ createdAt: -1 }).lean(),
  ]);

  return NextResponse.json({ group, tasks, doc, poll });
}
