import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { SavedReference } from "@/lib/db/models/SavedReference";

export const runtime = "nodejs";

// GET /api/catalog/library — the user's saved references ("Pustaka Saya").
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const items = await SavedReference.find({ userId: session.user.id })
    .sort({ savedAt: -1 })
    .lean();
  return NextResponse.json({ items });
}

// POST /api/catalog/library — save a reference (idempotent per user+refId).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  const refId = String(body?.refId || body?.doi || title).trim();
  if (!title || !refId) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  await connectDB();
  const doc = await SavedReference.findOneAndUpdate(
    { userId: session.user.id, refId },
    {
      $set: {
        title,
        authors: Array.isArray(body?.authors)
          ? body.authors.map((a: unknown) => String(a)).slice(0, 30)
          : [],
        year: String(body?.year || ""),
        type: String(body?.type || ""),
        typeLabel: String(body?.typeLabel || ""),
        journal: String(body?.journal || ""),
        publisher: String(body?.publisher || ""),
        doi: String(body?.doi || ""),
        url: String(body?.url || ""),
      },
      $setOnInsert: { userId: session.user.id, refId, savedAt: new Date() },
    },
    { upsert: true, new: true }
  );
  return NextResponse.json({ item: doc }, { status: 201 });
}

// DELETE /api/catalog/library?id=... (Mongo _id) or ?refId=...
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const refId = searchParams.get("refId");
  if (!id && !refId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await connectDB();
  const filter: Record<string, unknown> = { userId: session.user.id };
  if (id) filter._id = id;
  else filter.refId = refId;
  await SavedReference.deleteOne(filter);
  return NextResponse.json({ success: true });
}
