import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Document } from "@/lib/db/models/Document";
import { DocumentChunk } from "@/lib/db/models/DocumentChunk";
import { StudyNote } from "@/lib/db/models/StudyNote";
import { aiComplete, RAG_CONTEXT_CHARS, RAG_CHUNK_LIMIT } from "@/lib/ai";
import { buildSystemPrompt } from "@/lib/ai-prompts";
import { sanitizeOutput } from "@/lib/sanitize-output";

export const runtime = "nodejs";


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

  const instruction = `Buat catatan belajar terstruktur dari materi mahasiswa dalam Bahasa Indonesia, format Markdown dengan bagian persis berikut:

## Ringkasan
Ringkasan singkat isi materi (3-5 kalimat).

## Poin Penting
Bullet list poin-poin penting dari materi.

## Istilah Kunci
Daftar istilah/konsep kunci beserta definisi singkat.

## Pertanyaan Latihan
5 pertanyaan latihan untuk menguji pemahaman.

Dasarkan HANYA pada materi yang diberikan; jangan menambah informasi di luar materi.`;
  const system = buildSystemPrompt("helper", { sourceBlock: context }, instruction);

  let content: string;
  try {
    const { text } = await aiComplete({
      task: "summarize",
      system,
      user: "Buatkan catatan belajar terstruktur dari materi di atas sekarang.",
      temperature: 0.5,
    });
    content = sanitizeOutput(text);
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
