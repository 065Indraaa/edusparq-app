import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiComplete } from "@/lib/ai";
import { buildSystemPrompt, type StudentContext } from "@/lib/ai-prompts";
import { getUserPersonaContext } from "@/lib/ai-memory";
import { buildWritingGrounding } from "@/lib/rag-grounding";
import { sanitizeDocumentBody } from "@/lib/sanitize-output";

export const runtime = "nodejs";

const DOC_BLUEPRINTS: Record<string, string> = {
  makalah:
    "Struktur makalah ilmiah Indonesia: Judul, Abstrak, Pendahuluan (latar belakang, rumusan masalah, tujuan), Pembahasan (beberapa subbagian bertingkat), Kesimpulan, dan Daftar Pustaka (placeholder bila belum ada sumber).",
  esai:
    "Struktur esai akademik: Judul, paragraf pembuka (tesis jelas), 3-4 paragraf isi (tiap paragraf satu gagasan + bukti/argumen), paragraf penutup yang menegaskan tesis.",
  laporan:
    "Struktur laporan: Judul, Pendahuluan, Tujuan, Metode/Langkah, Hasil & Analisis, Kesimpulan & Saran.",
  proposal:
    "Struktur proposal penelitian: Judul, Latar Belakang, Rumusan Masalah, Tujuan & Manfaat, Tinjauan Pustaka singkat, Metode Penelitian, Jadwal, Daftar Pustaka.",
  artikel:
    "Struktur artikel populer-akademik: Judul menarik, lead pembuka, beberapa subjudul isi, penutup yang menggugah.",
  umum: "Struktur dokumen yang rapi dan logis sesuai topik.",
};

// POST /api/writing/draft — generate a full editable draft as clean HTML,
// grounded on the user's own material + web context to avoid hallucination.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const topic = String(body?.topic || "").trim();
  const docType = String(body?.docType || "makalah");
  const citationStyle = String(body?.citationStyle || "APA");
  const useWeb = Boolean(body?.useWeb !== false); // default ON for grounding
  if (topic.length < 3)
    return NextResponse.json(
      { error: "Tulis topik atau judul dulu (minimal 3 karakter)." },
      { status: 400 }
    );

  const ctx: StudentContext = {
    university: typeof body?.university === "string" ? body.university : undefined,
    major: typeof body?.major === "string" ? body.major : undefined,
  };

  // Grounding: pull the student's own material + optional web context.
  const { sourceBlock, hasGrounding } = await buildWritingGrounding(
    session.user.id,
    topic,
    { useWeb }
  );
  if (sourceBlock) ctx.sourceBlock = sourceBlock;

  const blueprint = DOC_BLUEPRINTS[docType] || DOC_BLUEPRINTS.umum;
  const groundingNote = hasGrounding
    ? `Anda DIBERIKAN konteks referensi nyata di blok [KUTIPAN DARI MATERI MAHASISWA]. JADIKAN ITU FONDASI UTAMA isi tulisan. Sebutkan sumber saat mengutip (mis. "Berdasarkan materi..."). Jika informasi kurang, lengkapi dengan analisis akademik valid, tetapi JANGAN mengarang data/referensi fiktif.`
    : `Tidak ada referensi tambahan yang tersedia. Tulis berdasarkan kerangka akademik valid; hindari mengarang data, angka, atau referensi yang tidak dapat dipertanggungjawabkan. Gunakan placeholder "[perlu referensi]" bila suatu klaim membutuhkan sumber.`;

  const instruction = `Tulis DRAFT LENGKAP (bukan kerangka/outline) untuk dokumen jenis "${docType}" dengan topik berikut. ${blueprint}

${groundingNote}

Gaya sitasi: ${citationStyle}. Tulis konten yang benar-benar berisi paragraf utuh dan argumen yang berkembang, bukan sekadar poin-poin.

KELUARKAN HANYA HTML BERSIH (tanpa <html>, <head>, <body>, tanpa blok kode markdown). Gunakan hanya tag: <h1> untuk judul, <h2>/<h3> untuk subjudul, <p> untuk paragraf, <ul>/<ol>/<li> untuk daftar, <strong>/<em> untuk penekanan, <blockquote> untuk kutipan. Mulai langsung dari <h1>.`;

  let system = buildSystemPrompt("editor", ctx, instruction);

  const personaContext = await getUserPersonaContext(session.user.id);
  if (personaContext) {
    system = personaContext + system;
  }

  try {
    const { text, provider, model } = await aiComplete({
      task: "draft",
      system,
      user: `Topik/Judul: ${topic}`,
      temperature: 0.7,
      maxTokens: 4096,
    });
    // Sanitize: strip invisible/decorative chars, then strip accidental fences.
    let html = sanitizeDocumentBody(text).trim();
    html = html
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    if (!html)
      return NextResponse.json(
        { error: "AI tidak menghasilkan draft. Coba lagi." },
        { status: 422 }
      );
    return NextResponse.json({ html, provider, model, grounded: hasGrounding });
  } catch {
    return NextResponse.json(
      { error: "Gagal menghubungi AI. Coba lagi sebentar." },
      { status: 502 }
    );
  }
}
