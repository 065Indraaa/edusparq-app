import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Document } from "@/lib/db/models/Document";
import { DocumentChunk } from "@/lib/db/models/DocumentChunk";
import { MaterialAnalysis } from "@/lib/db/models/MaterialAnalysis";
import { AI_MODEL, getGroqClient, parseLooseJSON } from "@/lib/ai";

export const runtime = "nodejs";

type AnalysisJSON = {
  keywords: string[];
  concepts: { nama: string; definisi: string }[];
  relations: { dari: string; ke: string; hubungan: string }[];
  contentTypes: string[];
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const doc = await Document.findOne({
    _id: params.id,
    userId: session.user.id,
  }).lean() as { _id: unknown; courseName: string } | null;

  if (!doc) {
    return NextResponse.json(
      { error: "Dokumen tidak ditemukan." },
      { status: 404 }
    );
  }

  const rawChunks = await DocumentChunk.find({
    documentId: doc._id,
    userId: session.user.id,
  })
    .sort({ chunkIndex: 1 })
    .limit(40)
    .lean();

  const chunks = rawChunks as Array<{ content: string }>;

  if (chunks.length === 0) {
    return NextResponse.json(
      {
        error:
          "Dokumen belum diindeks. Silakan indeks dokumen terlebih dahulu sebelum melakukan analisis materi.",
      },
      { status: 422 }
    );
  }

  // Build context capped at 24000 chars
  let context = "";
  for (const chunk of chunks) {
    const appended = context + chunk.content + "\n";
    if (appended.length > 24000) {
      context += chunk.content.slice(0, 24000 - context.length);
      break;
    }
    context = appended;
  }

  const prompt = `Kamu adalah analis materi pembelajaran. Tugasmu adalah mengekstrak informasi penting dari materi berikut. Gunakan HANYA informasi yang ada dalam materi; jangan menambahkan informasi dari luar.

MATERI:
${context}

Hasilkan HANYA objek JSON berikut tanpa penjelasan atau teks tambahan apapun:
{
  "keywords": ["kata kunci 1", "kata kunci 2"],
  "concepts": [{"nama": "nama konsep", "definisi": "definisi singkat konsep"}],
  "relations": [{"dari": "konsep A", "ke": "konsep B", "hubungan": "hubungan antara keduanya"}],
  "contentTypes": ["jenis konten 1", "jenis konten 2"]
}`;

  let rawResponse: string | null = null;
  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });
    rawResponse = completion.choices[0].message.content;
  } catch (err) {
    console.error("[analyze/POST] Groq error:", err);
    return NextResponse.json(
      { error: "Gagal menghubungi layanan AI. Silakan coba lagi nanti." },
      { status: 502 }
    );
  }

  if (!rawResponse) {
    return NextResponse.json(
      { error: "AI tidak memberikan respons. Silakan coba lagi." },
      { status: 422 }
    );
  }

  const parsed = parseLooseJSON<AnalysisJSON>(rawResponse);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "AI menghasilkan respons yang tidak dapat diproses. Silakan coba analisis ulang.",
      },
      { status: 422 }
    );
  }

  // Replace any prior analysis for this document
  await MaterialAnalysis.deleteMany({
    documentId: doc._id,
    userId: session.user.id,
  });

  const analysis = await MaterialAnalysis.create({
    userId: session.user.id,
    documentId: doc._id,
    courseName: doc.courseName ?? "",
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    concepts: Array.isArray(parsed.concepts) ? parsed.concepts : [],
    relations: Array.isArray(parsed.relations) ? parsed.relations : [],
    contentTypes: Array.isArray(parsed.contentTypes) ? parsed.contentTypes : [],
    createdAt: new Date(),
  });

  return NextResponse.json({ analysis });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const analysis = await MaterialAnalysis.findOne({
    documentId: params.id,
    userId: session.user.id,
  }).sort({ createdAt: -1 });

  return NextResponse.json({ analysis: analysis ?? null });
}
