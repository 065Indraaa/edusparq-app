import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Document } from "@/lib/db/models/Document";
import { DocumentChunk } from "@/lib/db/models/DocumentChunk";
import { StudyNote } from "@/lib/db/models/StudyNote";
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

// GET /api/documents/[id]/summarize — return latest saved StudyNote for this doc
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const note = await StudyNote.findOne({
    documentId: params.id,
    userId: session.user.id,
  })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ note: note ?? null });
}

// POST /api/documents/[id]/summarize — generate & save a structured study note
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const doc = await Document.findOne({
    _id: params.id,
    userId: session.user.id,
  }).lean();
  if (!doc)
    return NextResponse.json(
      { error: "Dokumen tidak ditemukan." },
      { status: 404 }
    );

  const chunks = await DocumentChunk.find({
    documentId: params.id,
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

  const prompt = `Kamu adalah asisten belajar akademik untuk mahasiswa Indonesia. Buatlah catatan belajar terstruktur dari materi berikut dalam Bahasa Indonesia. Gunakan format Markdown dengan bagian-bagian berikut:

## Ringkasan
Ringkasan singkat isi materi (3-5 kalimat).

## Poin Penting
Daftar poin-poin penting dari materi (gunakan bullet list).

## Istilah Kunci
Daftar istilah atau konsep kunci beserta definisi singkatnya.

## Pertanyaan Latihan
5 pertanyaan latihan untuk menguji pemahaman materi.

PENTING: Dasarkan HANYA pada materi yang diberikan di bawah ini. Jangan menambahkan informasi yang tidak ada dalam materi.

---
MATERI:
${context}`;

  let content: string;
  try {
    const completion = await getGroqClient().chat.completions.create({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 2048,
    });
    content = completion.choices[0].message.content ?? "";
  } catch {
    return NextResponse.json(
      { error: "Gagal menghubungi AI. Coba lagi sebentar." },
      { status: 502 }
    );
  }

  const note = await StudyNote.create({
    userId: session.user.id,
    documentId: params.id,
    courseName: doc.courseName ?? "",
    title: doc.originalName ?? "",
    content,
  });

  return NextResponse.json({ note });
}
