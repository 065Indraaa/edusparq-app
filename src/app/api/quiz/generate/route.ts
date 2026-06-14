import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Document } from "@/lib/db/models/Document";
import { DocumentChunk } from "@/lib/db/models/DocumentChunk";
import { Quiz } from "@/lib/db/models/Quiz";
import Groq from "groq-sdk";
import { AI_MODEL } from "@/lib/ai";

export const runtime = "nodejs";

let groqClient: Groq | null = null;
const getGroqClient = () => {
  if (!groqClient) {
    if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY belum diisi");
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
};

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
    .limit(40)
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
  const context = rawContext.slice(0, 24000);

  const prompt = `Kamu adalah asisten belajar akademik untuk mahasiswa Indonesia. Berdasarkan materi di bawah, buat ${questionCount} soal pilihan ganda dalam Bahasa Indonesia.

Kembalikan HANYA objek JSON mentah (tanpa kode markdown, tanpa penjelasan tambahan, langsung mulai dari karakter "{"), dengan format:
{
  "questions": [
    {
      "question": "teks pertanyaan",
      "options": ["A. pilihan satu", "B. pilihan dua", "C. pilihan tiga", "D. pilihan empat"],
      "correctIndex": 0,
      "explanation": "penjelasan singkat mengapa jawaban ini benar berdasarkan materi"
    }
  ]
}

Pastikan:
- Setiap soal memiliki tepat 4 pilihan jawaban
- "correctIndex" adalah indeks (0–3) dari pilihan yang benar
- Soal bervariasi tingkat kesulitannya
- Soal didasarkan HANYA pada materi yang diberikan
- Gunakan Bahasa Indonesia yang jelas dan akademik

---
MATERI:
${context}`;

  let rawText: string;
  try {
    const completion = await getGroqClient().chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 3072,
    });
    rawText = completion.choices[0].message.content ?? "";
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
    const cleaned = rawText
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
