import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { connectDB } from "../../../lib/db/mongodb";
import { StudyNote } from "../../../lib/db/models/StudyNote";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const courseName = req.nextUrl.searchParams.get("courseName")?.trim();

  try {
    await connectDB();

    const query: Record<string, unknown> = { userId: session.user.id };
    if (courseName) {
      query.courseName = courseName;
    }

    const notes = await StudyNote.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json(notes);
  } catch (err) {
    console.error("[api/notes] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  const courseName = String(body?.courseName || "").trim();
  const content = String(body?.content || "").trim();

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  try {
    await connectDB();
    const note = await StudyNote.create({
      userId: session.user.id,
      title,
      courseName,
      content,
    });
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    console.error("[api/notes] POST error:", err);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
