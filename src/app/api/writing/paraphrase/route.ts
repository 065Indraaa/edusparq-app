import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { aiComplete } from "../../../../lib/ai";
import { buildSystemPrompt } from "../../../../lib/ai-prompts";
import { getUserPersonaContext } from "../../../../lib/ai-memory";
import { sanitizeOutput } from "../../../../lib/sanitize-output";

export const runtime = "nodejs";

// POST /api/writing/paraphrase — rewrite selected text academically.
// Streams the paraphrased result back as SSE.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = String(body?.text || "").trim();
  const targetLang = body?.lang === "english" ? "english" : "indonesian";

  if (text.length < 2)
    return NextResponse.json({ error: "Pilih teks dulu." }, { status: 400 });
  if (text.length > 6000)
    return NextResponse.json(
      { error: "Teks terlalu panjang. Pilih bagian yang lebih pendek." },
      { status: 400 }
    );

  const instruction = `Parafrase teks berikut menjadi kalimat akademik yang sangat formal, kohesif, dan elegan dalam bahasa ${
    targetLang === "english" ? "Inggris" : "Indonesia"
  }.

Instruksi:
1. Tingkatkan struktur kalimat menjadi lebih kompleks dan analitis tanpa mengubah makna asli.
2. Ganti kosakata umum dengan terminologi akademik tingkat tinggi yang tepat sasaran.
3. Pastikan transisi antar gagasan mengalir secara logis (kohesi dan koherensi).
4. JANGAN memberikan pengantar, penjelasan, atau tanda kutip. HANYA keluarkan hasil parafrase akhir yang siap disalin.`;

  let system = buildSystemPrompt("editor", undefined, instruction);
  const personaContext = await getUserPersonaContext(session.user.id);
  if (personaContext) system = personaContext + system;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { text: result } = await aiComplete({
          task: "draft",
          system,
          user: text,
          temperature: 0.6,
          maxTokens: 2048,
        });
        const clean = sanitizeOutput(result, { stripWrappingQuotes: true });
        const parts = clean.match(/.{1,40}/gs) || [clean];
        for (const part of parts) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: part })}\n\n`));
          await new Promise((r) => setTimeout(r, 8));
        }
      } catch {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ text: "Gagal memparafrase. Coba lagi sebentar." })}\n\n`
          )
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
