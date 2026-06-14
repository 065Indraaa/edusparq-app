import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { CollabPoll } from "@/lib/db/models/Collab";
import { getMemberGroup, broadcastToGroup } from "@/lib/collab";

// POST /api/collab/poll - create/replace the group's poll.
//   body: { groupId, question, options: string[] }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const groupId = String(body?.groupId || "");
  const question = String(body?.question || "").trim();
  const rawOptions: unknown = body?.options;
  const options = Array.isArray(rawOptions)
    ? rawOptions.map((o) => String(o).trim()).filter(Boolean).slice(0, 6)
    : [];

  if (!question || options.length < 2) {
    return NextResponse.json({ error: "Pertanyaan dan minimal 2 opsi wajib diisi." }, { status: 400 });
  }

  await connectDB();
  const group = await getMemberGroup(groupId, session.user.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // One active poll per group: remove the previous one.
  await CollabPoll.deleteMany({ groupId: group._id });
  const poll = await CollabPoll.create({
    groupId: group._id,
    question,
    options: options.map((label) => ({ label, voterIds: [] })),
    createdBy: session.user.id,
  });

  await broadcastToGroup(String(group._id), "poll:changed", { senderId: session.user.id });
  return NextResponse.json(poll, { status: 201 });
}

// PATCH /api/collab/poll - cast a vote (one vote per user, switchable).
//   body: { groupId, pollId, optionIndex }
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const groupId = String(body?.groupId || "");
  const pollId = String(body?.pollId || "");
  const optionIndex = Number(body?.optionIndex);

  await connectDB();
  const group = await getMemberGroup(groupId, session.user.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const poll = await CollabPoll.findOne({ _id: pollId, groupId: group._id });
  if (!poll) return NextResponse.json({ error: "Voting tidak ditemukan." }, { status: 404 });
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) {
    return NextResponse.json({ error: "Opsi tidak valid." }, { status: 400 });
  }

  const uid = String(session.user.id);
  // Remove this user's vote from every option, then add to the chosen one.
  poll.options.forEach((opt: { voterIds: { toString(): string }[] }) => {
    opt.voterIds = opt.voterIds.filter((v) => String(v) !== uid);
  });
  poll.options[optionIndex].voterIds.push(session.user.id);
  await poll.save();

  await broadcastToGroup(String(group._id), "poll:changed", { senderId: session.user.id });
  return NextResponse.json(poll);
}
