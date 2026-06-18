import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { Document } from "../../../../lib/db/models/Document";
import { DocumentChunk } from "../../../../lib/db/models/DocumentChunk";
import { Quiz } from "../../../../lib/db/models/Quiz";
import { aiComplete, RAG_CONTEXT_CHARS, RAG_CHUNK_LIMIT } from "../../../../lib/ai";
import { buildSystemPrompt } from "../../../../lib/ai-prompts";
import { sanitizeOutput } from "../../../../lib/sanitize-output";

export const runtime = "nodejs";


// GET /api/quiz/generate?documentId= — list quizzes for a doc (or all user quizzes)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get("documentId");

  const query: Record<string, unknown> = { userId: session.user.id };
  if (documentId) query.documentId = documentId;

  const quizzes = await Quiz.find(query).sort({ createdAt: -1 }).lean();
  return NextResponse.json(quizzes);
}

// POST /api/quiz/generate — generate & save a multiple-choice quiz from a document
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

  // clamp: default 5, min 1, max 15
  const questionCount = Math.min(Math.max(Number(count) || 5, 1), 15);

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

  const jsonContract = `Buat ${questionCount} soal pilihan ganda dalam Bahasa Indonesia berdasarkan materi mahasiswa. Kembalikan HANYA objek JSON mentah (tanpa kode markdown, langsung mulai dari "{"):
{
  "questions": [
    {
      "question": "teks pertanyaan",
      "options": ["A. pilihan satu", "B. pilihan dua", "C. pilihan tiga", "D. pilihan empat"],
      "correctIndex": 0,
      "explanation": "penjelasan singkat kenapa jawaban ini benar berdasarkan materi"
    }
  ]
}
Aturan: tepat 4 pilihan tiap soal; "correctIndex" 0-3; variasikan tingkat kesulitan (C1-C6 Bloom); distraktor harus masuk akal; soal HANYA dari materi yang diberikan.`;
  const system = buildSystemPrompt("examiner", { sourceBlock: context }, jsonContract);

  let rawText: string;
  try {
    const { text } = await aiComplete({
      task: "quiz",
      system,
      user: `Buat ${questionCount} soal pilihan ganda sekarang berdasarkan materi di atas.`,
      temperature: 0.6,
      maxTokens: 4096,
      json: true,
      userId: session.user.id,
    });
    rawText = text;
  } catch {
    return NextResponse.json(
      { error: "Gagal menghubungi AI. Coba lagi sebentar." },
      { status: 502 }
    );
  }

  // Defensive JSON parse: strip ```json fences, locate first {
  let parsed: {
    questions: Array<{
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    }>;
  };
  try {
    const cleaned = sanitizeOutput(rawText, { stripCodeFences: true })
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    const start = cleaned.indexOf("{");
    if (start === -1) throw new Error("Objek JSON tidak ditemukan dalam respons AI.");
    const jsonStr = cleaned.slice(start);
    const result = JSON.parse(jsonStr);
    if (!result.questions || !Array.isArray(result.questions))
      throw new Error("Shape JSON tidak valid: 'questions' array tidak ada.");
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

  const questions = parsed.questions.slice(0, questionCount).map((q) => ({
    question: String(q.question ?? "").trim(),
    options: Array.isArray(q.options)
      ? q.options.slice(0, 4).map((o) => String(o))
      : [],
    correctIndex:
      typeof q.correctIndex === "number" &&
      q.correctIndex >= 0 &&
      q.correctIndex <= 3
        ? Math.floor(q.correctIndex)
        : 0,
    explanation: String(q.explanation ?? "").trim(),
  }));

  const quiz = await Quiz.create({
    userId: session.user.id,
    documentId,
    courseName: doc.courseName ?? "",
    questions,
  });

  return NextResponse.json({ quiz });
}
