import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiComplete } from "@/lib/ai";
import { buildSystemPrompt } from "@/lib/ai-prompts";
import { getUserPersonaContext } from "@/lib/ai-memory";

export const runtime = "nodejs";

const ACTIONS: Record<string, string> = {
  improve:
    "Perbaiki kualitas akademik teks ini: rapikan struktur kalimat, diksi, dan kejelasan, TANPA mengubah makna. Pertahankan bahasa aslinya.",
  paraphrase:
    "Parafrasekan teks ini menjadi bahasa akademik yang formal dan orisinal, makna tetap sama, hindari plagiarisme.",
  expand:
    "Kembangkan teks ini menjadi lebih lengkap: tambah penjelasan, contoh, atau argumen pendukung yang relevan, tetap koheren dengan teks aslinya.",
  shorten:
    "Ringkas teks ini menjadi lebih padat tanpa kehilangan poin penting. Pertahankan bahasa aslinya.",
  academic:
    "Ubah teks ini menjadi gaya bahasa akademik formal yang baku (Bahasa Indonesia), perbaiki istilah dan struktur.",
  english:
    "Terjemahkan teks ini ke Bahasa Inggris akademik yang formal dan natural.",
};

// POST /api/writing/action — transform a selected piece of text inline.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");
  const text = String(body?.text || "").trim();
  const instruction = ACTIONS[action];

  if (!instruction)
    return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  if (text.length < 1)
    return NextResponse.json({ error: "Pilih teks dulu." }, { status: 400 });
  if (text.length > 6000)
    return NextResponse.json(
      { error: "Teks terlalu panjang. Pilih bagian yang lebih pendek." },
      { status: 400 }
    );

  let system = buildSystemPrompt(
    "editor",
    undefined,
    `${instruction}\n\nKELUARKAN HANYA hasil teksnya saja, tanpa penjelasan, tanpa tanda kutip pembungkus, tanpa markdown.`
  );

  const personaContext = await getUserPersonaContext(session.user.id);
  if (personaContext) {
    system = personaContext + system;
  }

  try {
    const { text: result } = await aiComplete({
      task: "draft",
      system,
      user: text,
      temperature: 0.6,
      maxTokens: 2048,
    });
    const cleaned = result.trim().replace(/^["“']|["”']$/g, "");
    if (!cleaned)
      return NextResponse.json(
        { error: "AI tidak menghasilkan hasil. Coba lagi." },
        { status: 422 }
      );
    return NextResponse.json({ result: cleaned });
  } catch {
    return NextResponse.json(
      { error: "Gagal menghubungi AI. Coba lagi sebentar." },
      { status: 502 }
    );
  }
}
