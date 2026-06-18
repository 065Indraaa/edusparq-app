import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiComplete } from "@/lib/ai";
import { buildSystemPrompt, type StudentContext } from "@/lib/ai-prompts";
import { getUserPersonaContext } from "@/lib/ai-memory";
import { retrieveUserMaterial } from "@/lib/rag-grounding";
import { sanitizeOutput } from "@/lib/sanitize-output";
import { buildJurusanAwareContext } from "@/lib/jurusan-context";

export const runtime = "nodejs";

// POST /api/writing/outline — generate a structured academic outline.
// Streams Markdown bullets back as SSE so the editor can render progressively.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const topic = String(body?.topic || "").trim();
  const citationGuide = String(body?.citationGuide || "APA").trim();

  if (topic.length < 3)
    return NextResponse.json(
      { error: "Tulis topik minimal 3 karakter." },
      { status: 400 }
    );

  // Fetch real profile from DB + jurusan context (not from client body).
  const { studentContext: ctx, jurusanPromptExtra } = await buildJurusanAwareContext(
    session.user.id
  );

  // Grounding on the user's own material (best-effort).
  const material = await retrieveUserMaterial(session.user.id, topic, 4);
  if (material) ctx.sourceBlock = material;

  const instruction = `Buat kerangka konseptual (outline) komprehensif, logis, dan analitis untuk makalah akademik tentang topik berikut.

${material ? "Anda diberi KUTIPAN dari materi kuliah pengguna. Jadikan itu fondasi struktur; jika kurang, lengkapi dengan kerangka akademik valid." : "Tidak ada referensi tambahan. Susun kerangka akademik standar yang valid, jangan mengarang referensi."}

Instruksi:
1. Mulai struktur standar (Pendahuluan, Tinjauan Pustaka, Metodologi, Pembahasan, Penutup).
2. Tiap bab berisi 2-3 sub-bab spesifik & relevan.
3. Bahasa Indonesia baku, formal, akademis.
4. Beri catatan singkat di bawah tiap poin tentang apa yang harus dibahas.
5. Format keluaran: Markdown bullet list yang rapi dan mudah disalin.

Gaya sitasi yang akan dipakai: ${citationGuide}.`;

  let system = buildSystemPrompt("editor", ctx, instruction);
  const personaContext = await getUserPersonaContext(session.user.id);
  if (personaContext) system = personaContext + system;
  if (jurusanPromptExtra) system += "\n\n" + jurusanPromptExtra;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { text } = await aiComplete({
          task: "draft",
          system,
          user: `Topik Utama: "${topic}"`,
          temperature: 0.6,
          maxTokens: 2048,
        });
        const clean = sanitizeOutput(text);
        // Stream in small chunks so the client can render progressively.
        const parts = clean.match(/.{1,40}/gs) || [clean];
        for (const part of parts) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: part })}\n\n`));
          // Yield to the event loop.
          await new Promise((r) => setTimeout(r, 8));
        }
      } catch {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ text: "Gagal menyusun kerangka. Coba lagi sebentar." })}\n\n`
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
