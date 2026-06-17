import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Flashcard } from "@/lib/db/models/Flashcard";
import { flashcardSchema } from "@/lib/validations";

// GET /api/flashcards[?due=true] — list all, or only cards due for review.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const onlyDue = searchParams.get("due") === "true";

  if (onlyDue) {
    const dueCards = await Flashcard.find({
      userId: session.user.id,
      due: { $lte: new Date() },
    }).sort({ due: 1, lapses: -1 });
    return NextResponse.json(dueCards);
  }

  const flashcards = await Flashcard.find({ userId: session.user.id }).sort({ createdAt: -1 });
  return NextResponse.json(flashcards);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = flashcardSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await connectDB();
  const flashcard = await Flashcard.create({ userId: session.user.id, ...parsed.data });
  return NextResponse.json(flashcard, { status: 201 });
}
