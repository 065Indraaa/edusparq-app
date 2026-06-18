import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { CatatanRapi } from "../../../../lib/db/models/CatatanRapi";
import { aiComplete } from "../../../../lib/ai";

export const runtime = "nodejs";

type Format = "dokumen" | "presentasi" | "poin";

// GET /api/notes/refine — list the user's tidied notes (most recent first).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const items = await CatatanRapi.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
  return NextResponse.json({ items });
}

function buildPrompt(format: Format, raw: string, courseName: string): string {
  const ctx = courseName ? ` untuk mata kuliah "${courseName}"` : "";
  const base = `Kamu adalah asisten akademik untuk mahasiswa Indonesia. Rapikan dan KEMBANGKAN catatan kasar berikut${ctx} menjadi catatan yang jelas, terstruktur, dan enak dibaca. Lengkapi bagian yang kurang, perbaiki istilah, tapi JANGAN mengarang fakta yang tidak masuk akal. Gunakan Bahasa Indonesia. Output HANYA dalam format Markdown, tanpa basa-basi pembuka.`;

  if (format === "presentasi") {
    return `${base}

Susun sebagai KERANGKA PRESENTASI. Mulai dengan "# Judul Presentasi". Lalu untuk tiap slide gunakan format:
## Slide N: Judul Slide
- poin ringkas
- poin ringkas
> Catatan pembicara: 1-2 kalimat panduan bicara.

Buat 5-10 slide yang mengalir logis (pembuka, isi, penutup).

---
CATATAN KASAR:
${raw}`;
  }

  if (format === "poin") {
    return `${base}

Susun sebagai RINGKASAN POIN. Mulai dengan "# Judul". Lalu:
## Inti
- poin-poin utama (ringkas, padat)
## Istilah Kunci
- **istilah** — definisi singkat
## Yang Perlu Didalami
- pertanyaan/celah untuk dipelajari lebih lanjut

---
CATATAN KASAR:
${raw}`;
  }

  return `${base}

Susun sebagai DOKUMEN rapi. Mulai dengan "# Judul". Gunakan heading (##), sub-poin, dan paragraf penjelas yang mengembangkan tiap ide. Tambahkan bagian "## Ringkasan" di akhir.

---
CATATAN KASAR:
${raw}`;
}

function extractJudul(md: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim().slice(0, 120) : "Catatan";
}

// POST /api/notes/refine — tidy + expand rough notes into the chosen format.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const raw = String(body?.rawInput || "").trim();
  const courseName = String(body?.courseName || "").trim();
  const formatType: Format = ["dokumen", "presentasi", "poin"].includes(body?.format)
    ? body.format
    : "dokumen";

  if (raw.length < 10) {
    return NextResponse.json({ error: "Tulis catatan kasarmu dulu (minimal beberapa kalimat)." }, { status: 400 });
  }

  let content: string;
  try {
    const { text } = await aiComplete({
      task: "summarize",
      user: buildPrompt(formatType, raw.slice(0, 8000), courseName),
      temperature: 0.5,
      maxTokens: 2048,
      userId: session.user.id,
    });
    content = (text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Gagal menghubungi AI. Coba lagi sebentar." }, { status: 502 });
  }

  if (!content) {
    return NextResponse.json({ error: "AI tidak memberi hasil. Coba lagi." }, { status: 422 });
  }

  await connectDB();
  const note = await CatatanRapi.create({
    userId: session.user.id,
    courseName,
    judul: extractJudul(content),
    formatType,
    rawInput: raw,
    content,
  });

  return NextResponse.json({ note });
}

// DELETE /api/notes/refine?id=...
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await connectDB();
  await CatatanRapi.deleteOne({ _id: id, userId: session.user.id });
  return NextResponse.json({ success: true });
}
