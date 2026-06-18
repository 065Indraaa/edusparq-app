import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { Flashcard } from "../../../../lib/db/models/Flashcard";
import { applySrs, type SrsRating } from "../../../../lib/srs";

export const runtime = "nodejs";

// POST /api/flashcards/review — record a spaced-repetition review for one card.
// Body: { id, rating } where rating is 0|1|2|3 (again|hard|good|easy).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  const ratingRaw = Number(body?.rating);
  if (!id)
    return NextResponse.json({ error: "id wajib diisi." }, { status: 400 });
  if (![0, 1, 2, 3].includes(ratingRaw))
    return NextResponse.json(
      { error: "rating harus 0 (lagi), 1 (sulit), 2 (baik), atau 3 (mudah)." },
      { status: 400 }
    );

  await connectDB();

  const card = await Flashcard.findOne({
    _id: id,
    userId: session.user.id,
  });

  if (!card)
    return NextResponse.json({ error: "Flashcard tidak ditemukan." }, { status: 404 });

  const next = applySrs(
    {
      reps: card.reps ?? 0,
      ease: card.ease ?? 2.5,
      interval: card.interval ?? 0,
      lapses: card.lapses ?? 0,
    },
    ratingRaw as SrsRating
  );

  card.reps = next.reps;
  card.ease = next.ease;
  card.interval = next.interval;
  card.lapses = next.lapses;
  card.due = next.due;
  card.lastReviewed = new Date();
  await card.save();

  return NextResponse.json({
    id: card._id,
    reps: card.reps,
    ease: card.ease,
    interval: card.interval,
    lapses: card.lapses,
    due: card.due,
    intervalDays: next.intervalDays,
  });
}
