import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { Document } from "../../../../lib/db/models/Document";
import { DocumentChunk } from "../../../../lib/db/models/DocumentChunk";
import { User } from "../../../../lib/db/models/User";
import { retrieveChunks, buildContextBlock } from "../../../../lib/rag";
import { searchWeb } from "../../../../lib/web-search";
import { buildSystemPrompt } from "../../../../lib/ai-prompts";
import { sanitizeOutput } from "../../../../lib/sanitize-output";
import { streamComplete, InsufficientCreditsError } from "../../../../lib/ai-client";
import { getJurusanPromptForUser } from "../../../../lib/jurusan-context";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/exams/solve — Assignment Solver.
 *
 * Grounds the answer on (1) the user's own material via RAG, (2) optional web
 * search, and (3) the user's academic profile. Streams the Kimi response back
 * as SSE. This is the "do the assignment for me" tool, so it uses the `solver`
 * persona and a low temperature for factual, citation-aware output.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const question = String(body?.question || "").trim();
  const documentId = body?.documentId ? String(body.documentId) : "";
  const useWebSearch = Boolean(body?.useWebSearch);

  if (!question) {
    return NextResponse.json(
      { error: "Pertanyaan tugas wajib diisi." },
      { status: 400 }
    );
  }

  await connectDB();

  // Resolve the student profile for grounding (best-effort, never throws).
  let profile: { name?: string; universitas?: string; fakultas?: string; prodi?: string; semester?: number } = {};
  try {
    const user = await User.findById(session.user.id).lean();
    if (user) {
      profile = {
        name: user.name,
        universitas: user.universitas,
        fakultas: user.fakultas,
        prodi: user.prodi,
        semester: user.semester,
      };
    }
  } catch {
    /* keep empty profile */
  }

  const quota = await (await import("../../../../lib/credit-billing")).getBalance(session.user.id);
  if (quota <= 0) {
    return NextResponse.json(
      { error: "Credit Anda habis. Isi ulang di /billing atau aktifkan BYOK di /settings/ai.", code: "INSUFFICIENT_CREDITS" },
      { status: 402 }
    );
  }

  const sourceParts: string[] = [];

  // 1. RAG from a specific uploaded document (if provided).
  if (documentId) {
    const doc = await Document.findOne({
      _id: documentId,
      userId: session.user.id,
    })
      .select("courseName")
      .lean();
    if (doc) {
      // Use targeted retrieval scoped to this document via chunks directly.
      const chunks = await DocumentChunk.find({
        documentId,
        userId: session.user.id,
        $text: { $search: question },
      })
        .sort({ score: { $meta: "textScore" } })
        .limit(5)
        .lean();
      if (chunks.length > 0) {
        const block = chunks
          .map(
            (c: any, i: number) =>
              `[Sumber Dokumen ${i + 1}: ${doc.courseName || "Materi"}]\n${String(c.content || "").trim()}`
          )
          .join("\n\n");
        sourceParts.push(`REFERENSI DARI DOKUMEN INTERNAL:\n${block}`);
      }
    }
  }

  // 2. Broader RAG across all of the user's documents (complements #1).
  try {
    const retrieved = await retrieveChunks(session.user.id, question, 4);
    if (retrieved.length > 0) {
      sourceParts.push(`REFERENSI DARI MATERI TERKAIT:\n${buildContextBlock(retrieved)}`);
    }
  } catch {
    /* non-fatal */
  }

  // 3. Optional web search grounding for real-world data.
  if (useWebSearch) {
    try {
      const web = await searchWeb(question, 4);
      if (web) sourceParts.push(web);
    } catch {
      /* non-fatal */
    }
  }

  const sourceBlock = sourceParts.join("\n\n");

  // Jurusan-aware context (non-blocking).
  let jurusanExtra = "";
  try {
    jurusanExtra = await getJurusanPromptForUser(session.user.id);
  } catch {
    /* non-fatal */
  }

  const systemPrompt = buildSystemPrompt(
    "solver",
    {
      name: profile.name,
      university: profile.universitas,
      faculty: profile.fakultas,
      major: profile.prodi,
      semester: profile.semester,
      sourceBlock: sourceBlock || undefined,
    },
    `Konteks tugas: mahasiswa meminta bantuan menyelesaikan tugas. ${
      sourceBlock
        ? "Gunakan SUMBER yang dilampirkan sebagai rujukan UTAMA dan sebutkan sumbernya (misal: Berdasarkan dokumen X, atau Menurut hasil pencarian web)."
        : "Tidak ada sumber tambahan. Jawab dengan basis pengetahuan akademik valid; jika tidak yakin, nyatakan dengan jujur."
    } Susun jawaban profesional tingkat universitas, terstruktur, dan bebas simbol dekoratif.${jurusanExtra ? "\n\n" + jurusanExtra : ""}`
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let streamed = false;
      await streamComplete(
        {
          feature: "solver",
          system: systemPrompt,
          user: `Berikut adalah instruksi tugas saya:\n\n${question}`,
          temperature: 0.2,
          maxTokens: 3000,
        },
        {
          onToken: (delta) => {
            const clean = sanitizeOutput(delta, { collapseRuns: false });
            if (clean) {
              streamed = true;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: clean })}\n\n`)
              );
            }
          },
          onError: (err) => {
            console.error("[exams/solve] stream error:", err);
            let msg =
              "Mohon maaf, asisten AI sedang mengalami kendala koneksi. Silakan coba kirim ulang tugas Anda dalam beberapa saat.";
            if (err instanceof InsufficientCreditsError) {
              msg =
                "⚠️ Credit tidak cukup untuk menyelesaikan tugas ini. Isi ulang di /billing atau aktifkan BYOK.";
            }
            if (!streamed) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: msg })}\n\n`)
              );
            }
          },
          onDone: () => {
            if (!streamed) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text: "Tidak ada respons dari AI." })}\n\n`
                )
              );
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        },
        session.user.id
      );
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
