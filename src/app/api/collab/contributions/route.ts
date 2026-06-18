import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { CollabTask, CollabGroup } from "../../../../lib/db/models/Collab";

export const runtime = "nodejs";

interface TaskLean {
  assigneeUserId?: unknown;
  assignee?: string;
  completed?: boolean;
  bobotKontribusi?: number;
}

// GET /api/collab/contributions?groupId=...
// Returns per-member contribution: selesai count, totalBobot, persen.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId") || "";

  await connectDB();
  const group = await CollabGroup.findOne({ _id: groupId, "members.userId": session.user.id });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tasks = (await CollabTask.find({ groupId: group._id }).lean()) as TaskLean[];

  const result = group.members.map(
    (member: { userId: { toString(): string }; name: string }) => {
      const memberIdStr = String(member.userId);

      const completedTasks = tasks.filter((t) => {
        if (!t.completed) return false;
        // Match by assigneeUserId first, fall back to name match
        if (t.assigneeUserId) return String(t.assigneeUserId) === memberIdStr;
        return typeof t.assignee === "string" && t.assignee === member.name;
      });

      const totalBobot = completedTasks.reduce(
        (sum, t) => sum + (typeof t.bobotKontribusi === "number" ? t.bobotKontribusi : 1),
        0
      );

      return { userId: memberIdStr, nama: member.name, selesai: completedTasks.length, totalBobot };
    }
  );

  const sumBobot = result.reduce((sum: number, r: { totalBobot: number }) => sum + r.totalBobot, 0);
  const withPersen = result.map((r: { userId: string; nama: string; selesai: number; totalBobot: number }) => ({
    ...r,
    persen: sumBobot > 0 ? Math.round((r.totalBobot / sumBobot) * 100) : 0,
  }));

  return NextResponse.json(withPersen);
}
