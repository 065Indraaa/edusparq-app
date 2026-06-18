import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { ChatMessage } from "@/lib/db/models/ChatMessage";
import { User } from "@/lib/db/models/User";
import { retrieveChunks, computeConfidence, buildContextBlock } from "@/lib/rag";
import { extractTextFromUrl } from "@/lib/server-extract";
import { checkRateLimit } from "@/lib/rate-limit";
import { streamComplete, InsufficientCreditsError } from "@/lib/ai-client";
import { buildSystemPrompt, personaFromMode } from "@/lib/ai-prompts";
import { getUserPersonaContext, extractAndStorePersona } from "@/lib/ai-memory";
import { sanitizeOutput } from "@/lib/sanitize-output";
import { runOrchestrator, type OrchestratorResult } from "@/lib/agents/orchestrator";
import { buildJurusanAwareContext } from "@/lib/jurusan-context";


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

  // Rate limit: 15 requests / minute / user.
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const { allowed, retryAfterMs } = checkRateLimit(`chat_${ip}`, 15, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: `Terlalu banyak request. Coba lagi dalam ${Math.ceil(retryAfterMs / 1000)} detik.` },
      { status: 429 }
    );
  }

  // Credit check.
  const { getBalance } = await import("@/lib/credit-billing");
  const balance = await getBalance(session.user.id);
  if (balance <= 0) {
    return NextResponse.json(
      {
        error:
          "Credit Anda habis. Isi ulang di /billing atau aktifkan BYOK di /settings/ai untuk pakai kunci sendiri.",
      },
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

  // Check user agent mode (auto = orchestrator, simple = langsung streaming).
  const user = await User.findById(session.user.id).lean();
  const agentMode = user?.agentMode || "auto";

  // Save user message
  await ChatMessage.create({
    userId: session.user.id,
    role: "user",
    content: message,
    mode,
    courseName: typeof courseName === "string" ? courseName : "",
  });

  // ─── RAG + Attachment (shared setup) ──────────────────────────────────────
  const chunks = await retrieveChunks(session.user.id, message, 4);
  const confidence = chunks.length > 0 ? computeConfidence(chunks) : "Unknown";
  const sources = chunks.slice(0, 3).map((c) => ({
    title: c.courseName || "Materi",
    exactQuote: (c.content || "").slice(0, 180),
    documentId: c.documentId,
  }));

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

  const sourceBlock = chunks.length > 0 ? buildContextBlock(chunks) : undefined;

  // ─── BRANCH: Orchestrator (mode auto) vs Simple streaming ─────────────────
  if (agentMode === "auto" && !attachmentUrl) {
    // Orchestrator handles non-attachment messages with multi-agent pipeline.
    return handleOrchestratorChat(
      session.user.id,
      message,
      mode,
      courseName,
      sourceBlock,
      sources,
      confidence
    );
  }

  // Fallback: simple streaming (legacy path, also used for attachments).
  return handleSimpleStreamingChat(
    session.user.id,
    message,
    mode,
    courseName,
    sourceBlock,
    attachmentContent,
    sources,
    confidence
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR CHAT HANDLER — multi-agent pipeline for auto mode
// ─────────────────────────────────────────────────────────────────────────────

async function handleOrchestratorChat(
  userId: string,
  message: string,
  mode: string,
  courseName: string,
  sourceBlock: string | undefined,
  sources: { title: string; exactQuote: string; documentId: string }[],
  confidence: string
) {
  const encoder = new TextEncoder();
  const metaPayload = JSON.stringify({ text: "", meta: { sources, confidence } });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const result = await runOrchestrator({
          userId,
          request: message,
          courseName: courseName || undefined,
          tutorMode: mode,
          sourceBlock,
        });

        // Stream the output as word-level chunks so UI still animates.
        const words = result.output.split(/(\s+)/);
        for (const word of words) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: sanitizeOutput(word, { collapseRuns: false }) })}\n\n`)
          );
        }

        // Save assistant response.
        try {
          await ChatMessage.create({
            userId,
            role: "assistant",
            content: result.output,
            mode,
            courseName,
            // Store trace as metadata in a hidden field for UI display.
          });
        } catch {}

        // Emit agent metadata (tier, credit cost) for UI.
        const agentMeta = JSON.stringify({
          text: "",
          meta: {
            sources,
            confidence,
            agentTier: result.tier,
            agentCost: result.totalCreditCost,
            agentTrace: result.trace.map((t) => ({
              agent: t.agent,
              status: t.status,
              summary: t.summary?.slice(0, 120) || "",
              creditCost: t.creditCost || 0,
            })),
          },
        });
        controller.enqueue(encoder.encode(`data: ${agentMeta}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        console.error("[chat orchestrator error]:", err);
        let errText = "Sistem agent sedang mengalami kendala. Silakan coba lagi.";
        if (err instanceof InsufficientCreditsError) {
          errText = "⚠️ Credit Anda tidak cukup. Isi ulang di menu Billing.";
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: errText })}\n\n`)
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
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

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE STREAMING HANDLER — legacy single-call path
// ─────────────────────────────────────────────────────────────────────────────

async function handleSimpleStreamingChat(
  userId: string,
  message: string,
  mode: string,
  courseName: string,
  sourceBlock: string | undefined,
  attachmentContent: string,
  sources: { title: string; exactQuote: string; documentId: string }[],
  confidence: string
) {
  // Recent history for context (last 10 messages).
  const history = await ChatMessage.find({ userId })
    .sort({ createdAt: -1 })
    .limit(10);
  const historyMessages = history.reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Build system prompt — enriched with jurusan-aware context.
  let { studentContext, jurusanPromptExtra } = { studentContext: {} as any, jurusanPromptExtra: "" };
  try {
    const jc = await buildJurusanAwareContext(userId, {
      courseName: courseName ? String(courseName) : undefined,
      sourceBlock,
    });
    studentContext = jc.studentContext;
    jurusanPromptExtra = jc.jurusanPromptExtra;
  } catch {
    /* non-fatal */
  }
  let systemPrompt = buildSystemPrompt(personaFromMode(mode), studentContext);
  const personaContext = await getUserPersonaContext(userId);
  if (personaContext) systemPrompt = personaContext + systemPrompt;
  if (jurusanPromptExtra) systemPrompt += "\n\n" + jurusanPromptExtra;
  if (attachmentContent) systemPrompt += attachmentContent;

  const encoder = new TextEncoder();
  let fullResponse = "";
  const metaPayload = JSON.stringify({ text: "", meta: { sources, confidence } });

  const readable = new ReadableStream({
    async start(controller) {
      let streamed = false;
      await streamComplete(
        {
          feature: "chat",
          system: systemPrompt,
          messages: historyMessages,
          temperature: 0.3,
          maxTokens: 1024,
        },
        {
          onToken: (delta) => {
            const text = sanitizeOutput(delta, { collapseRuns: false });
            if (text) {
              streamed = true;
              fullResponse += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          },
          onError: (err) => {
            console.error("[chat streaming error]:", err);
            let errText =
              "Mohon maaf, sistem AI sedang mengalami kendala koneksi ke server pusat. Silakan coba kirim ulang pesan Anda dalam beberapa saat.";
            if (err instanceof InsufficientCreditsError) {
              errText =
                "⚠️ Credit Anda tidak cukup untuk operasi ini. Isi ulang di menu Billing, atau aktifkan BYOK (kunci sendiri) di Pengaturan AI untuk lanjut gratis.";
            }
            fullResponse = fullResponse || errText;
            if (!streamed) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: errText })}\n\n`));
            }
          },
        },
        userId
      );

      // Save complete AI response to DB (best-effort).
      try {
        await ChatMessage.create({
          userId,
          role: "assistant",
          content: fullResponse,
          mode,
          courseName,
        });
      } catch {}

      // Background: extract persona memory.
      extractAndStorePersona(userId).catch((err) => {
        console.error("[Background Task] extractAndStorePersona failed:", err);
      });

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
