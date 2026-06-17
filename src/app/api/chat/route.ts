import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { ChatMessage } from "@/lib/db/models/ChatMessage";
import { retrieveChunks, computeConfidence, buildContextBlock } from "@/lib/rag";
import { extractTextFromUrl } from "@/lib/server-extract";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkAndDeductQuota } from "@/lib/quota";
import OpenAI from "openai";
import { AI_MODEL } from "@/lib/ai";
import { buildSystemPrompt, personaFromMode } from "@/lib/ai-prompts";
import { getUserPersonaContext, extractAndStorePersona } from "@/lib/ai-memory";
import { sanitizeOutput } from "@/lib/sanitize-output";

let kimiClient: OpenAI | null = null;
const getKimiClient = () => {
  if (!kimiClient) {
    if (!process.env.MOONSHOT_API_KEY) {
      throw new Error("MOONSHOT_API_KEY belum diisi di .env.local");
    }
    kimiClient = new OpenAI({ 
      apiKey: process.env.MOONSHOT_API_KEY,
      baseURL: "https://www.phanrouter.com/phanrouter/v1"
    });
  }
  return kimiClient;
};


export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const messages = await ChatMessage.find({ userId: session.user.id })
    .sort({ createdAt: 1 })
    .limit(100);

  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 20 requests / minute / user.
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const { allowed, retryAfterMs } = checkRateLimit(`chat_${ip}`, 15, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: `Terlalu banyak request. Coba lagi dalam ${Math.ceil(retryAfterMs / 1000)} detik.` },
      { status: 429 }
    );
  }

  // Pengecekan Quota Pengguna
  const quota = await checkAndDeductQuota(session.user.id);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Batas kuota bulanan Anda (50 Chat) telah habis. Kuota akan di-reset otomatis bulan depan." },
      { status: 402 }
    );
  }

  const { message, mode = "helper", courseName = "", attachmentUrl, attachmentType } = await req.json();
  if (!message?.trim() && !attachmentUrl) return NextResponse.json({ error: "Message required" }, { status: 400 });
  if (message.length > 4000) {
    return NextResponse.json(
      { error: "Pesan terlalu panjang. Ringkas dulu (maksimal 4000 karakter), ya." },
      { status: 400 }
    );
  }

  await connectDB();

  // Save user message
  await ChatMessage.create({
    userId: session.user.id,
    role: "user",
    content: message,
    mode,
    courseName: typeof courseName === "string" ? courseName : "",
  });

  // Recent history for context (last 10 messages, newest first).
  const history = await ChatMessage.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(10);

  // `history` already includes the just-saved user message as its most recent
  // item, so we do NOT append it again below (double-send would waste tokens).
  const historyMessages = history.reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // RAG: retrieve grounding chunks from the student's own documents.
  const chunks = await retrieveChunks(session.user.id, message, 4);
  const confidence = chunks.length > 0 ? computeConfidence(chunks) : "Unknown";

  const sources = chunks.slice(0, 3).map((c) => ({
    title: c.courseName || "Materi",
    exactQuote: (c.content || "").slice(0, 180),
    documentId: c.documentId,
  }));

  // Handle direct file attachment extraction
  let attachmentContent = "";
  if (attachmentUrl && attachmentType) {
    try {
      const extractedText = await extractTextFromUrl(attachmentUrl, attachmentType);
      if (extractedText.trim()) {
        attachmentContent = `\n\n[LAMPIRAN LANGSUNG DARI PENGGUNA]\nBerikut adalah isi dokumen yang baru saja dilampirkan oleh pengguna. Jadikan ini sebagai konteks utama jika relevan dengan pertanyaan:\n${extractedText.slice(0, 15000)}`;
      }
    } catch (err) {
      console.error("[chat] failed to extract attachment:", err);
    }
  }

  // Persona akademik profesional + grounding ke materi mahasiswa (RAG).
  const sourceBlock = chunks.length > 0 ? buildContextBlock(chunks) : undefined;
  
  // Build system prompt, injecting attachment directly if present.
  let systemPrompt = buildSystemPrompt(personaFromMode(mode), {
    sourceBlock,
    courses: courseName ? [String(courseName)] : undefined,
  });

  // Inject user persona/memory context
  const personaContext = await getUserPersonaContext(session.user.id);
  if (personaContext) {
    systemPrompt = personaContext + systemPrompt;
  }

  if (attachmentContent) {
    systemPrompt += attachmentContent;
  }

  const encoder = new TextEncoder();
  let fullResponse = "";

  const metaPayload = JSON.stringify({ text: "", meta: { sources, confidence } });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Call Kimi SDK with streaming
        const stream = await getKimiClient().chat.completions.create({
          model: AI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            ...historyMessages,
          ],
          stream: true,
          temperature: 0.3, // Lowered temperature for zero-hallucination professional output
          max_tokens: 1024,
        });

        for await (const chunk of stream) {
          const rawDelta = chunk.choices[0]?.delta?.content || "";
          const text = sanitizeOutput(rawDelta, { collapseRuns: false });
          fullResponse += text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
      } catch (err) {
        console.error("[chat streaming error]:", err);
        // Degrade gracefully: stream a professional error token instead of 500-ing.
        const errText = "Mohon maaf, sistem AI sedang mengalami kendala koneksi ke server pusat. Silakan coba kirim ulang pesan Anda dalam beberapa saat.";
        fullResponse = fullResponse || errText;
        if (fullResponse === errText) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: errText })}\n\n`));
        }
      }

      // Save complete AI response to DB (best-effort).
      try {
        await ChatMessage.create({
          userId: session.user.id,
          role: "assistant",
          content: fullResponse,
          mode,
          courseName: typeof courseName === "string" ? courseName : "",
        });
      } catch {}

      // Background worker: trigger persona extraction asynchronously 
      // Fire-and-forget so it doesn't block the request.
      extractAndStorePersona(session.user.id).catch(err => {
        console.error("[Background Task] extractAndStorePersona failed:", err);
      });

      // Emit metadata line (sources + confidence) right before [DONE].
      // text:"" keeps other SSE readers (writing/research) backward-compatible.
      controller.enqueue(encoder.encode(`data: ${metaPayload}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  await ChatMessage.deleteMany({ userId: session.user.id });
  return NextResponse.json({ success: true });
}
