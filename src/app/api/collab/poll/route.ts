import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { CollabPoll } from "../../../../lib/db/models/Collab";
import { getMemberGroup, broadcastToGroup } from "../../../../lib/collab";

// GET /api/collab/poll?groupId=... - fetch the active poll for a group.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId") || "";

  await connectDB();
  const group = await getMemberGroup(groupId, session.user.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const poll = await CollabPoll.findOne({ groupId: group._id })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(poll || null);
}

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

// PATCH /api/collab/poll?pollId=... - cast a vote by optionId (_id of the option subdocument).
//   body: { optionId }
// Also supports legacy body: { groupId, pollId, optionIndex } for backwards compatibility.
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const body = await req.json().catch(() => ({}));

  // Support both query-param pollId and body pollId (legacy)
  const pollId = searchParams.get("pollId") || String(body?.pollId || "");
  // Support optionId (_id string) from new frontend, or optionIndex (number) from legacy
  const optionId: string | undefined = typeof body?.optionId === "string" ? body.optionId : undefined;
  const optionIndex: number | undefined = typeof body?.optionIndex === "number" ? body.optionIndex : undefined;

  if (!pollId) return NextResponse.json({ error: "pollId wajib diisi." }, { status: 400 });

  await connectDB();

  const poll = await CollabPoll.findById(pollId);
  if (!poll) return NextResponse.json({ error: "Voting tidak ditemukan." }, { status: 404 });

  // Verify the user is a member of the poll's group
  const { getMemberGroup: _get } = await import("../../../../lib/collab");
  const group = await _get(String(poll.groupId), session.user.id);
  if (!group) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const uid = String(session.user.id);

  // Determine which option to vote for
  let targetIndex: number = -1;
  if (optionId) {
    // New frontend: find by _id string
    targetIndex = poll.options.findIndex(
      (opt: { _id: { toString(): string } }) => String(opt._id) === optionId
    );
  } else if (optionIndex !== undefined) {
    // Legacy: use numeric index
    targetIndex = optionIndex;
  }

  if (targetIndex < 0 || targetIndex >= poll.options.length) {
    return NextResponse.json({ error: "Opsi tidak valid." }, { status: 400 });
  }

  // Remove this user's vote from every option, then add to the chosen one.
  poll.options.forEach((opt: { voterIds: { toString(): string }[] }) => {
    opt.voterIds = opt.voterIds.filter((v) => String(v) !== uid);
  });
  poll.options[targetIndex].voterIds.push(session.user.id);
  await poll.save();

  await broadcastToGroup(String(group._id), "poll:changed", { senderId: session.user.id });
  return NextResponse.json(poll);
}
