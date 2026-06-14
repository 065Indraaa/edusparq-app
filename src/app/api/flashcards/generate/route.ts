import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Document } from "@/lib/db/models/Document";
import { DocumentChunk } from "@/lib/db/models/DocumentChunk";
import { Flashcard } from "@/lib/db/models/Flashcard";
import Groq from "groq-sdk";

export const runtime = "nodejs";

let groqClient: Groq | null = null;
const getGroqClient = () => {
  if (!groqClient) {
    if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY belum diisi");
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
};

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
  const context = rawContext.slice(0, 12000);

  const prompt = `Kamu adalah asisten belajar akademik. Berdasarkan materi di bawah, buat ${cardCount} flashcard dalam Bahasa Indonesia.

Kembalikan HANYA array JSON mentah (tanpa kode markdown, tanpa penjelasan tambahan, langsung mulai dari karakter "["), dengan format:
[
  {
    "front": "pertanyaan atau konsep yang diuji",
    "back": "jawaban atau penjelasan singkat",
    "difficulty": "easy"
  }
]

Nilai "difficulty" hanya boleh: "easy", "medium", atau "hard".
Tentukan tingkat kesulitan berdasarkan kompleksitas konsep.
Dasarkan HANYA pada materi yang diberikan. Jangan menambahkan informasi di luar materi.

---
MATERI:
${context}`;

  let rawText: string;
  try {
    const completion = await getGroqClient().chat.completions.create({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 2048,
    });
    rawText = completion.choices[0].message.content ?? "";
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
