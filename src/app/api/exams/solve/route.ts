import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Document } from "@/lib/db/models/Document";
import { DocumentChunk } from "@/lib/db/models/DocumentChunk";
import { User } from "@/lib/db/models/User";
import { retrieveChunks, buildContextBlock } from "@/lib/rag";
import { searchWeb } from "@/lib/web-search";
import { AI_MODEL } from "@/lib/ai";
import { buildSystemPrompt } from "@/lib/ai-prompts";
import { sanitizeOutput } from "@/lib/sanitize-output";
import { checkAndDeductQuota } from "@/lib/quota";

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

  const quota = await checkAndDeductQuota(session.user.id);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Batas kuota bulanan Anda telah habis. Kuota akan di-reset otomatis bulan depan." },
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
    } Susun jawaban profesional tingkat universitas, terstruktur, dan bebas simbol dekoratif.`
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch(
          "https://www.phanrouter.com/phanrouter/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`,
            },
            body: JSON.stringify({
              model: AI_MODEL,
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: `Berikut adalah instruksi tugas saya:\n\n${question}`,
                },
              ],
              temperature: 0.2, // low for factual, grounded answers
              max_tokens: 3000,
              stream: true,
            }),
          }
        );

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "");
          throw new Error(`Kimi HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(payload);
              const delta = json?.choices?.[0]?.delta?.content || "";
              if (delta) {
                const clean = sanitizeOutput(delta, { collapseRuns: false });
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: clean })}\n\n`)
                );
              }
            } catch {
              /* skip malformed chunk */
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        console.error("[exams/solve] stream error:", err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              text: "Mohon maaf, asisten AI sedang mengalami kendala koneksi. Silakan coba kirim ulang tugas Anda dalam beberapa saat.",
            })}\n\n`
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
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
