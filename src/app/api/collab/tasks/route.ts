import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { CollabTask, CollabGroup } from "@/lib/db/models/Collab";
import { getMemberGroup, broadcastToGroup } from "@/lib/collab";

// GET /api/collab/tasks?groupId=... - list tasks for a group.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId") || "";

  await connectDB();
  const group = await getMemberGroup(groupId, session.user.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tasks = await CollabTask.find({ groupId: group._id })
    .sort({ createdAt: 1 })
    .lean();

  return NextResponse.json(tasks);
}

// POST /api/collab/tasks - add a task to a group.
//   body: { groupId, title, assignee?, dueDate? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const groupId = String(body?.groupId || "");
  const title = String(body?.title || "").trim();
  if (!title) return NextResponse.json({ error: "Judul tugas wajib diisi." }, { status: 400 });

  await connectDB();
  const group = await getMemberGroup(groupId, session.user.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const task = await CollabTask.create({
    groupId: group._id,
    title,
    assignee: String(body?.assignee || "").trim(),
    dueDate: String(body?.dueDate || "").trim(),
    createdBy: session.user.id,
  });

  await broadcastToGroup(String(group._id), "task:changed", { senderId: session.user.id });
  return NextResponse.json(task, { status: 201 });
}

// PATCH /api/collab/tasks?id=... - toggle/update a task (no groupId required).
//   body: { completed?, title?, assignee?, dueDate? }
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("id") || "";

  const body = await req.json().catch(() => ({}));

  await connectDB();

  // Find task first, then verify membership
  const task = await CollabTask.findById(taskId);
  if (!task) return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });

  // Verify the user is a member of the task's group
  const isMember = await CollabGroup.exists({
    _id: task.groupId,
    "members.userId": session.user.id,
  });
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const update: Record<string, unknown> = {};
  if (typeof body.completed === "boolean") update.completed = body.completed;
  if (typeof body.title === "string") update.title = body.title.trim();
  if (typeof body.assignee === "string") update.assignee = body.assignee.trim();
  if (typeof body.dueDate === "string") update.dueDate = body.dueDate.trim();

  const updated = await CollabTask.findByIdAndUpdate(
    taskId,
    { $set: update },
    { new: true }
  );

  await broadcastToGroup(String(task.groupId), "task:changed", { senderId: session.user.id });
  return NextResponse.json(updated);
}

// DELETE /api/collab/tasks?id=... - delete a task.
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("id") || "";

  await connectDB();

  const task = await CollabTask.findById(taskId);
  if (!task) return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });

  // Verify membership
  const isMember = await CollabGroup.exists({
    _id: task.groupId,
    "members.userId": session.user.id,
  });
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await CollabTask.deleteOne({ _id: taskId });
  await broadcastToGroup(String(task.groupId), "task:changed", { senderId: session.user.id });
  return NextResponse.json({ success: true });
}
