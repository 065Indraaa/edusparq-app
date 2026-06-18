import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { CollabDoc } from "../../../../lib/db/models/Collab";
import { getMemberGroup, broadcastToGroup } from "../../../../lib/collab";

// GET /api/collab/doc?groupId=... - fetch the shared document content for a group.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId") || "";

  await connectDB();
  const group = await getMemberGroup(groupId, session.user.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = await CollabDoc.findOne({ groupId: group._id }).lean();
  return NextResponse.json(doc || { content: "" });
}

// POST /api/collab/doc - persist the shared document content for a group.
//   body: { groupId, content }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const groupId = String(body?.groupId || "");
  const content = typeof body?.content === "string" ? body.content : "";

  await connectDB();
  const group = await getMemberGroup(groupId, session.user.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = await CollabDoc.findOneAndUpdate(
    { groupId: group._id },
    { $set: { content, updatedBy: session.user.name || "", updatedAt: new Date() } },
    { new: true, upsert: true }
  );

  await broadcastToGroup(String(group._id), "doc:update", {
    content,
    senderId: session.user.id,
    name: session.user.name || "Anggota",
  });

  return NextResponse.json(doc);
}

// PUT /api/collab/doc - alias for POST (legacy support).
export async function PUT(req: NextRequest) {
  return POST(req);
}
