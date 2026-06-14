import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { CollabDoc } from "@/lib/db/models/Collab";
import { getMemberGroup, broadcastToGroup } from "@/lib/collab";

// PUT /api/collab/doc - persist the shared document content for a group.
//   body: { groupId, content }
// The realtime keystroke sync still goes through Pusher (fast path); this is the
// durable save so content survives reloads and is the source of truth on load.
export async function PUT(req: NextRequest) {
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
