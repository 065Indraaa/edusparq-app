import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Document } from "@/lib/db/models/Document";
import { DocumentChunk } from "@/lib/db/models/DocumentChunk";
import { Flashcard } from "@/lib/db/models/Flashcard";
import { aiComplete, RAG_CONTEXT_CHARS, RAG_CHUNK_LIMIT } from "@/lib/ai";
import { buildSystemPrompt } from "@/lib/ai-prompts";

export const runtime = "nodejs";


const VALID_DIFFICULTIES = ["easy", "medium", "hard"] as const;

// POST /api/flashcards/generate — generate flashcards from a document's indexed chunks
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { documentId, count } = body as {
    documentId?: string;
    count?: number;
  };

  if (!documentId) {
    return NextResponse.json(
      { error: "documentId diperlukan." },
      { status: 400 }
    );
  }

  // clamp: default 8, min 1, max 20
  const cardCount = Math.min(Math.max(Number(count) || 8, 1), 20);

  await connectDB();

  const doc = await Document.findOne({
    _id: documentId,
    userId: session.user.id,
  }).lean();
  if (!doc)
    return NextResponse.json(
      { error: "Dokumen tidak ditemukan." },
      { status: 404 }
    );

  const chunks = await DocumentChunk.find({
    documentId,
    userId: session.user.id,
  })
    .sort({ chunkIndex: 1 })
    .limit(RAG_CHUNK_LIMIT)
    .lean();

  if (chunks.length === 0) {
    return NextResponse.json(
      {
        error:
          "Dokumen ini belum diindeks. Silakan indeks atau indeks ulang dokumen terlebih dahulu agar AI dapat membaca materinya.",
      },
      { status: 422 }
    );
  }

  const rawContext = chunks.map((c) => c.content).join("\n\n");
  const context = rawContext.slice(0, RAG_CONTEXT_CHARS);

  const instruction = `Buat ${cardCount} flashcard dalam Bahasa Indonesia berdasarkan materi mahasiswa. Kembalikan HANYA array JSON mentah (tanpa kode markdown, langsung mulai dari "["):
[
  { "front": "pertanyaan atau konsep yang diuji", "back": "jawaban atau penjelasan singkat", "difficulty": "easy" }
]
Aturan: "difficulty" hanya "easy" | "medium" | "hard" sesuai kompleksitas konsep; dasarkan HANYA pada materi yang diberikan, jangan menambah info di luar materi.`;
  const system = buildSystemPrompt("examiner", { sourceBlock: context }, instruction);

  let rawText: string;
  try {
    const { text } = await aiComplete({
      task: "flashcards",
      system,
      user: `Buat ${cardCount} flashcard sekarang berdasarkan materi di atas.`,
      temperature: 0.6,
    });
    rawText = text;
  } catch {
    return NextResponse.json(
      { error: "Gagal menghubungi AI. Coba lagi sebentar." },
      { status: 502 }
    );
  }

  // Defensive JSON parse: strip ```json fences, locate first [
  let parsed: Array<{ front: string; back: string; difficulty: string }>;
  try {
    const cleaned = rawText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    const start = cleaned.indexOf("[");
    if (start === -1) throw new Error("Array JSON tidak ditemukan dalam respons AI.");
    const jsonStr = cleaned.slice(start);
    const result = JSON.parse(jsonStr);
    if (!Array.isArray(result)) throw new Error("Respons AI bukan array.");
    parsed = result;
  } catch {
    return NextResponse.json(
      {
        error:
          "AI mengembalikan format yang tidak terbaca. Coba generate ulang.",
      },
      { status: 422 }
    );
  }

  const docs = parsed.slice(0, cardCount).map((card) => ({
    userId: session.user.id,
    courseId: doc.courseId,
    courseName: doc.courseName ?? "Umum",
    front: String(card.front ?? "").trim(),
    back: String(card.back ?? "").trim(),
    difficulty: VALID_DIFFICULTIES.includes(
      card.difficulty as (typeof VALID_DIFFICULTIES)[number]
    )
      ? card.difficulty
      : "medium",
  }));

  const created = await Flashcard.insertMany(docs);

  return NextResponse.json({ created });
}
