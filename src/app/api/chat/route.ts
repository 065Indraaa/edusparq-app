import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { ChatMessage } from "@/lib/db/models/ChatMessage";
import { retrieveChunks, computeConfidence, buildContextBlock } from "@/lib/rag";
import { checkRateLimit } from "@/lib/rate-limit";
import Groq from "groq-sdk";

let groqClient: Groq | null = null;
const getGroqClient = () => {
  if (!groqClient) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY belum diisi di .env.local");
    }
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
};

const SYSTEM_PROMPTS: Record<string, string> = {
  socratic: `Kamu adalah tutor akademik yang menggunakan metode Socratic untuk mahasiswa Indonesia. 
Jangan pernah memberikan jawaban langsung. Selalu bantu mahasiswa berpikir sendiri dengan mengajukan pertanyaan-pertanyaan yang mengarahkan.
Gunakan bahasa Indonesia yang santai tapi tetap akademik. Jangan gunakan kata-kata yang terlalu formal seperti "saya siap membantu Anda".
Mulailah dengan memahami apa yang sudah diketahui mahasiswa tentang topik tersebut.`,

  helper: `Kamu adalah asisten akademik untuk mahasiswa Indonesia. Berikan penjelasan yang jelas, terstruktur, dan mudah dipahami.
Gunakan bahasa Indonesia yang natural — seperti kakak atau teman yang lebih senior menjelaskan ke adik kelasnya.
Hindari jargon AI seperti "Tentu!", "Dengan senang hati!", atau "Saya akan membantu Anda".
Langsung ke inti masalah. Gunakan contoh nyata dari konteks Indonesia bila relevan.`,

  research: `Kamu adalah asisten riset akademik untuk mahasiswa Indonesia. 
Bantu mahasiswa menemukan sudut pandang penelitian, metodologi yang tepat, dan sumber-sumber relevan.
Gunakan bahasa Indonesia akademik yang mengalir natural. Jangan seperti robot — bicara seperti dosen pembimbing yang menyenangkan.
Bila membahas jurnal atau referensi, jelaskan secara singkat kenapa referensi itu relevan.`,
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

  const { message, mode = "helper" } = await req.json();
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
  });

  // Get recent history for context (last 10 messages)
  const history = await ChatMessage.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(10);

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

  // Build the system prompt, grounding it in retrieved sources when available.
  let systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.helper;
  if (chunks.length > 0) {
    const contextBlock = buildContextBlock(chunks);
    systemPrompt +=
      `\n\nBerikut adalah kutipan dari materi/dokumen mahasiswa yang relevan dengan pertanyaan. ` +
      `Dasarkan jawabanmu pada sumber-sumber ini sebisa mungkin, dan sebutkan secara jujur ketika ada informasi yang tidak tercakup di dalamnya.\n\n` +
      `${contextBlock}`;
  }

  const encoder = new TextEncoder();
  let fullResponse = "";

  const metaPayload = JSON.stringify({ text: "", meta: { sources, confidence } });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Call Groq API with streaming
        const stream = await getGroqClient().chat.completions.create({
          model: "llama3-70b-8192",
          messages: [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: message },
          ],
          stream: true,
          temperature: 0.75,
          max_tokens: 1024,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          fullResponse += text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
      } catch {
        // Degrade gracefully: stream a friendly error token instead of 500-ing.
        const errText = "Maaf, terjadi kendala saat menghubungi tutor. Coba kirim lagi sebentar lagi, ya.";
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
