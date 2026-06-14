import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { CollabTask } from "@/lib/db/models/Collab";
import { getMemberGroup, broadcastToGroup } from "@/lib/collab";

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

// PATCH /api/collab/tasks - toggle/update a task.
//   body: { groupId, taskId, completed?, title?, assignee?, dueDate? }
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const groupId = String(body?.groupId || "");
  const taskId = String(body?.taskId || "");

  await connectDB();
  const group = await getMemberGroup(groupId, session.user.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (typeof body.completed === "boolean") update.completed = body.completed;
  if (typeof body.title === "string") update.title = body.title.trim();
  if (typeof body.assignee === "string") update.assignee = body.assignee.trim();
  if (typeof body.dueDate === "string") update.dueDate = body.dueDate.trim();

  const task = await CollabTask.findOneAndUpdate(
    { _id: taskId, groupId: group._id },
    { $set: update },
    { new: true }
  );
  if (!task) return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });

  await broadcastToGroup(String(group._id), "task:changed", { senderId: session.user.id });
  return NextResponse.json(task);
}

// DELETE /api/collab/tasks?groupId=..&taskId=..
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId") || "";
  const taskId = searchParams.get("taskId") || "";

  await connectDB();
  const group = await getMemberGroup(groupId, session.user.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await CollabTask.deleteOne({ _id: taskId, groupId: group._id });
  await broadcastToGroup(String(group._id), "task:changed", { senderId: session.user.id });
  return NextResponse.json({ success: true });
}
