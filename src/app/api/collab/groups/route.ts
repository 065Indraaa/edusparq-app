import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { CollabGroup, CollabDoc } from "../../../../lib/db/models/Collab";
import { generateJoinCode } from "../../../../lib/collab";

// GET /api/collab/groups - list groups the current user belongs to.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const groups = await CollabGroup.find({ "members.userId": session.user.id })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(groups);
}

// POST /api/collab/groups - create a new group, or join one by code.
//   body: { action: "create", name }  |  { action: "join", joinCode }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const me = { userId: session.user.id, name: session.user.name || "Anggota" };

  await connectDB();

  if (action === "create") {
    const name = String(body?.name || "").trim();
    if (!name) return NextResponse.json({ error: "Nama grup wajib diisi." }, { status: 400 });

    // Find a unique join code (retry a few times on the off chance of collision).
    let joinCode = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidate = generateJoinCode(Date.now() + attempt * 1337);
      const exists = await CollabGroup.exists({ joinCode: candidate });
      if (!exists) {
        joinCode = candidate;
        break;
      }
    }
    if (!joinCode) return NextResponse.json({ error: "Gagal membuat kode grup. Coba lagi." }, { status: 500 });

    const group = await CollabGroup.create({
      name,
      ownerId: session.user.id,
      joinCode,
      members: [me],
    });
    // Initialize an empty shared document for the group.
    await CollabDoc.create({ groupId: group._id, content: "" });

    return NextResponse.json(group, { status: 201 });
  }

  if (action === "join") {
    const joinCode = String(body?.joinCode || "").trim().toUpperCase();
    if (!joinCode) return NextResponse.json({ error: "Kode grup wajib diisi." }, { status: 400 });

    const group = await CollabGroup.findOne({ joinCode });
    if (!group) return NextResponse.json({ error: "Grup dengan kode tersebut tidak ditemukan." }, { status: 404 });

    const already = group.members.some(
      (m: { userId: { toString(): string } }) => String(m.userId) === String(session.user!.id)
    );
    if (!already) {
      group.members.push(me);
      await group.save();
    }
    return NextResponse.json(group);
  }

  return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
