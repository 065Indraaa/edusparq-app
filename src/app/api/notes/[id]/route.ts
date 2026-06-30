import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { StudyNote } from "../../../../lib/db/models/StudyNote";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!mongoose.isValidObjectId(params.id)) {
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
  }

  try {
    await connectDB();
    const note = await StudyNote.findOne({
      _id: params.id,
      userId: session.user.id,
    }).lean();

    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (err) {
    console.error("[api/notes/[id]] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch note" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!mongoose.isValidObjectId(params.id)) {
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, string> = {};

  if (typeof body?.title === "string") update.title = body.title.trim();
  if (typeof body?.courseName === "string") update.courseName = body.courseName.trim();
  if (typeof body?.content === "string") update.content = body.content.trim();

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    await connectDB();
    const note = await StudyNote.findOneAndUpdate(
      { _id: params.id, userId: session.user.id },
      { $set: update },
      { new: true }
    ).lean();

    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (err) {
    console.error("[api/notes/[id]] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!mongoose.isValidObjectId(params.id)) {
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
  }

  try {
    await connectDB();
    const note = await StudyNote.findOneAndDelete({
      _id: params.id,
      userId: session.user.id,
    }).lean();

    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/notes/[id]] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
