import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Document } from "@/lib/db/models/Document";
import { DocumentChunk } from "@/lib/db/models/DocumentChunk";
import { PracticePaper } from "@/lib/db/models/PracticePaper";
import { aiComplete, parseLooseJSON, RAG_CONTEXT_CHARS, RAG_CHUNK_LIMIT } from "@/lib/ai";
import { buildSystemPrompt } from "@/lib/ai-prompts";

export const runtime = "nodejs";

interface GenQuestion {
  type?: string;
  question?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
  idealAnswer?: string;
}

// GET /api/exams/practice — list the user's practice papers (newest first).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const papers = await PracticePaper.find({ userId: session.user.id })
    .sort({ updatedAt: -1 })
    .lean();
  return NextResponse.json({ papers });
}

// POST /api/exams/practice — generate a new practice paper (MC + essay) via Kimi.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const courseName = String(body?.courseName || "").trim();
  const topic = String(body?.topic || "").trim();
  const documentId = body?.documentId ? String(body.documentId) : "";
  const mcCount = Math.min(Math.max(Number(body?.mcCount) || 5, 0), 12);
  const essayCount = Math.min(Math.max(Number(body?.essayCount) || 2, 0), 6);

  if (!courseName && !topic && !documentId)
    return NextResponse.json(
      { error: "Isi mata kuliah/topik atau pilih materi dulu." },
      { status: 400 }
    );
  if (mcCount + essayCount === 0)
    return NextResponse.json(
      { error: "Pilih minimal satu jenis soal." },
      { status: 400 }
    );

  await connectDB();

  // Optional grounding from an uploaded document.
  let context = "";
  let docCourse = "";
  if (documentId) {
    const doc = await Document.findOne({ _id: documentId, userId: session.user.id }).lean() as
      | { courseName?: string }
      | null;
    if (!doc)
      return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
    docCourse = doc.courseName || "";
    const chunks = await DocumentChunk.find({ documentId, userId: session.user.id })
      .sort({ chunkIndex: 1 })
      .limit(RAG_CHUNK_LIMIT)
      .lean();
    context = chunks.map((c) => c.content).join("\n\n").slice(0, RAG_CONTEXT_CHARS);
    if (!context)
      return NextResponse.json(
        { error: "Dokumen ini belum diindeks. Indeks ulang dulu, ya." },
        { status: 422 }
      );
  }

  const subject = courseName || docCourse || topic || "mata kuliah";
  const jsonContract = `Susun paper latihan ujian untuk "${subject}"${topic ? ` fokus topik "${topic}"` : ""}: ${mcCount} soal pilihan ganda dan ${essayCount} soal esai, Bahasa Indonesia. Kembalikan HANYA objek JSON mentah (langsung dari "{"):
{
  "questions": [
    { "type": "mc", "question": "...", "options": ["A. ...","B. ...","C. ...","D. ..."], "correctIndex": 0, "explanation": "kenapa benar", "points": 10 },
    { "type": "essay", "question": "...", "idealAnswer": "poin-poin kunci jawaban ideal", "points": 25 }
  ]
}
Aturan: soal MC tepat 4 pilihan, correctIndex 0-3, distraktor masuk akal; soal esai menuntut analisis (C4-C6 Bloom); variasikan kesulitan${context ? "; soal HANYA dari materi yang diberikan" : ""}.`;

  const system = buildSystemPrompt(
    "examiner",
    context ? { sourceBlock: context } : { courses: [subject] },
    jsonContract
  );

  let raw: string;
  try {
    const { text } = await aiComplete({
      task: "quiz",
      system,
      user: `Susun ${mcCount} soal pilihan ganda dan ${essayCount} soal esai sekarang.`,
      temperature: 0.6,
      maxTokens: 4096,
      json: true,
    });
    raw = text;
  } catch {
    return NextResponse.json(
      { error: "Gagal menghubungi AI. Coba lagi sebentar." },
      { status: 502 }
    );
  }

  const parsed = parseLooseJSON<{ questions: GenQuestion[] }>(raw);
  if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0)
    return NextResponse.json(
      { error: "AI mengembalikan format yang tidak terbaca. Coba lagi." },
      { status: 422 }
    );

  const questions = parsed.questions
    .map((q) => {
      const type = q.type === "essay" ? "essay" : "mc";
      if (type === "mc") {
        const options = Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : [];
        if (options.length < 2) return null;
        const ci =
          typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex < options.length
            ? Math.floor(q.correctIndex)
            : 0;
        return {
          type,
          question: String(q.question || "").trim(),
          options,
          correctIndex: ci,
          explanation: String(q.explanation || "").trim(),
          points: Number(q.points) || 10,
          idealAnswer: "",
        };
      }
      return {
        type,
        question: String(q.question || "").trim(),
        options: [],
        correctIndex: 0,
        explanation: "",
        points: Number(q.points) || 25,
        idealAnswer: String(q.idealAnswer || "").trim(),
      };
    })
    .filter((q) => q && q.question);

  if (questions.length === 0)
    return NextResponse.json(
      { error: "AI tidak menghasilkan soal yang valid. Coba lagi." },
      { status: 422 }
    );

  const paper = await PracticePaper.create({
    userId: session.user.id,
    documentId: documentId || undefined,
    title: `Latihan: ${subject}`.slice(0, 120),
    courseName: courseName || docCourse,
    topic,
    questions,
  });

  return NextResponse.json({ paper });
}
