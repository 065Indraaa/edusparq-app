import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { ChatMessage } from "@/lib/db/models/ChatMessage";
import { retrieveChunks, computeConfidence, buildContextBlock } from "@/lib/rag";
import { checkRateLimit } from "@/lib/rate-limit";
import Groq from "groq-sdk";
import { AI_MODEL } from "@/lib/ai";
import { buildSystemPrompt, personaFromMode } from "@/lib/ai-prompts";

let kimiClient: Groq | null = null;
const getKimiClient = () => {
  if (!kimiClient) {
    if (!process.env.MOONSHOT_API_KEY) {
      throw new Error("MOONSHOT_API_KEY belum diisi di .env.local");
    }
    kimiClient = new Groq({ 
      apiKey: process.env.MOONSHOT_API_KEY,
      baseURL: "https://llm.kimchi.dev/openai/v1"
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
  const rl = checkRateLimit("chat:" + session.user.id, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
      { status: 429 }
    );
  }

  const { message, mode = "helper", courseName = "" } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });
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

  // Persona akademik profesional + grounding ke materi mahasiswa (RAG).
  const sourceBlock = chunks.length > 0 ? buildContextBlock(chunks) : undefined;
  const systemPrompt = buildSystemPrompt(personaFromMode(mode), {
    sourceBlock,
    courses: courseName ? [String(courseName)] : undefined,
  });

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
          const text = chunk.choices[0]?.delta?.content || "";
          fullResponse += text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
      } catch {
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
