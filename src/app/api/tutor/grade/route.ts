import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { AnswerEvaluation } from "@/lib/db/models/AnswerEvaluation";
import { AI_MODEL, getGroqClient, parseLooseJSON } from "@/lib/ai";

export const runtime = "nodejs";

// GET /api/tutor/grade — the user's grading history (most recent first).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const items = await AnswerEvaluation.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
  return NextResponse.json({ items });
}

interface GradeResult {
  score: number;
  verdict: string;
  feedback: string;
  strengths: string[];
  missing: string[];
  saran: string;
  idealAnswer: string;
}

// POST /api/tutor/grade — grade the accuracy of a student's answer (Dosen Virtual).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const question = String(body?.question || "").trim();
  const userAnswer = String(body?.answer || "").trim();
  const courseName = String(body?.courseName || "").trim();

  if (question.length < 5 || userAnswer.length < 1) {
    return NextResponse.json(
      { error: "Tulis soal dan jawabanmu terlebih dahulu." },
      { status: 400 }
    );
  }

  const prompt = `Kamu adalah dosen penguji yang adil dan teliti di perguruan tinggi Indonesia${
    courseName ? ` untuk mata kuliah "${courseName}"` : ""
  }. Nilai AKURASI jawaban mahasiswa terhadap soal berikut secara objektif.

SOAL:
${question}

JAWABAN MAHASISWA:
${userAnswer}

Kembalikan HANYA objek JSON mentah (tanpa markdown, langsung mulai dari "{"), format:
{
  "score": 85,
  "verdict": "ringkas, mis. Sangat Baik / Baik / Cukup / Perlu Perbaikan",
  "feedback": "penilaian singkat 2-4 kalimat, jelaskan kenapa skor segitu",
  "strengths": ["poin yang sudah benar/kuat"],
  "missing": ["poin yang salah, kurang, atau perlu ditambahkan"],
  "saran": "satu saran konkret untuk memperbaiki jawaban",
  "idealAnswer": "ringkasan jawaban ideal/kunci, maksimal 3 kalimat"
}

Aturan:
- "score" wajib bilangan bulat 0-100 yang mencerminkan akurasi & kelengkapan.
- Jujur dan akademik. Jika jawaban kosong/ngawur, beri skor rendah dan jelaskan.
- Gunakan Bahasa Indonesia yang jelas.`;

  let raw: string;
  try {
    const completion = await getGroqClient().chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1200,
    });
    raw = completion.choices[0]?.message?.content ?? "";
  } catch {
    return NextResponse.json(
      { error: "Gagal menghubungi AI. Coba lagi sebentar." },
      { status: 502 }
    );
  }

  const parsed = parseLooseJSON<Partial<GradeResult>>(raw);
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json(
      { error: "AI mengembalikan format yang tidak terbaca. Coba lagi." },
      { status: 422 }
    );
  }

  const scoreNum = Number(parsed.score);
  const score = Number.isFinite(scoreNum)
    ? Math.min(Math.max(Math.round(scoreNum), 0), 100)
    : 0;
  const toArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, 8) : [];

  await connectDB();
  const evaluation = await AnswerEvaluation.create({
    userId: session.user.id,
    courseName,
    question,
    userAnswer,
    score,
    verdict: String(parsed.verdict || "").trim(),
    feedback: String(parsed.feedback || "").trim(),
    strengths: toArr(parsed.strengths),
    missing: toArr(parsed.missing),
    saran: String(parsed.saran || "").trim(),
    idealAnswer: String(parsed.idealAnswer || "").trim(),
  });

  return NextResponse.json({ evaluation });
}
