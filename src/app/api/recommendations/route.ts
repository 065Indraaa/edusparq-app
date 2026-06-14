import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Course } from "@/lib/db/models/Course";
import { MaterialAnalysis } from "@/lib/db/models/MaterialAnalysis";
import { LearningRecommendation } from "@/lib/db/models/LearningRecommendation";
import { AI_MODEL, getGroqClient, parseLooseJSON, AI_MAX_TOKENS } from "@/lib/ai";

export const runtime = "nodejs";

type RecommendationItem = {
  topik: string;
  alasan: string;
  prioritas: "tinggi" | "sedang" | "rendah";
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const recommendations = await LearningRecommendation.find({
    userId: session.user.id,
  }).sort({ createdAt: -1 });

  return NextResponse.json({ recommendations });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // Gather the user's courses
  const rawCourses = await Course.find({ userId: session.user.id }).lean();
  const courses = rawCourses as Array<{ name: string }>;

  if (!courses || courses.length === 0) {
    return NextResponse.json(
      {
        error:
          "Kamu belum memiliki mata kuliah. Tambahkan mata kuliah terlebih dahulu untuk mendapatkan rekomendasi belajar.",
      },
      { status: 422 }
    );
  }

  // Gather recent MaterialAnalysis keywords to ground recommendations
  const rawAnalyses = await MaterialAnalysis.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  const analyses = rawAnalyses as Array<{ keywords?: string[]; courseName?: string }>;

  const courseNames = courses.map((c) => c.name).join(", ");
  const allKeywords = analyses
    .flatMap((a) => (Array.isArray(a.keywords) ? a.keywords : []))
    .slice(0, 60)
    .join(", ");

  const prompt = `Kamu adalah konsultan belajar. Berdasarkan informasi berikut, buat rekomendasi topik studi yang relevan untuk mahasiswa.

Mata kuliah yang sedang diambil: ${courseNames}
Kata kunci dari materi yang sudah dipelajari: ${allKeywords || "belum ada data materi"}

Hasilkan HANYA array JSON berikut tanpa penjelasan atau teks tambahan apapun (5-8 rekomendasi):
[
  {
    "topik": "nama topik yang perlu dipelajari",
    "alasan": "alasan singkat mengapa topik ini penting untuk mahasiswa ini",
    "prioritas": "tinggi"
  }
]

Nilai "prioritas" harus salah satu dari: "tinggi", "sedang", atau "rendah". Semua teks dalam Bahasa Indonesia.`;

  let rawResponse: string | null = null;
  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: AI_MAX_TOKENS.recommend,
    });
    rawResponse = completion.choices[0].message.content;
  } catch (err) {
    console.error("[recommendations/POST] Groq error:", err);
    return NextResponse.json(
      { error: "Gagal menghubungi layanan AI. Silakan coba lagi nanti." },
      { status: 502 }
    );
  }

  const parsed = rawResponse
    ? parseLooseJSON<RecommendationItem[]>(rawResponse)
    : null;

  // Graceful empty result if AI output can't be parsed
  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
    return NextResponse.json({
      created: [],
      message:
        "AI tidak dapat menghasilkan rekomendasi saat ini. Silakan coba lagi nanti.",
    });
  }

  const validPriorities = new Set(["tinggi", "sedang", "rendah"]);

  const docs = parsed.map((item) => ({
    userId: session.user.id,
    courseName: "",
    topik: typeof item.topik === "string" ? item.topik : "",
    alasan: typeof item.alasan === "string" ? item.alasan : "",
    prioritas: validPriorities.has(item.prioritas) ? item.prioritas : "sedang",
    createdAt: new Date(),
  }));

  // Replace prior recommendations for this user
  await LearningRecommendation.deleteMany({ userId: session.user.id });
  const created = await LearningRecommendation.insertMany(docs);

  return NextResponse.json({ created });
}
