import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { AgentSession } from "../../../../lib/db/models/AgentSession";
import { getBalance } from "../../../../lib/credit-billing";
import { InsufficientCreditsError } from "../../../../lib/ai-client";
import { runOrchestrator, type OrchestratorInput, type OrchestratorResult } from "../../../../lib/agents/orchestrator";
import type { ComplexityTier, TraceStep } from "../../../../lib/agents/context";

/**
 * POST /api/agent/run
 *
 * Menjalankan orchestrator multi-agen untuk satu permintaan user.
 * Menerima input, menyimpan AgentSession ke DB, mengembalikan output
 * final + trace untuk UI stepper.
 *
 * Body:
 *   - request (string, wajib) — permintaan user
 *   - courseName (string, opsional) — konteks mata kuliah
 *   - tutorMode (string, opsional) — persona tutor
 *   - sourceBlock (string, opsional) — RAG grounding text
 *   - webContext (string, opsional) — hasil web search
 *   - forceTier (string, opsional) — override tier: simple/medium/complex
 *   - parentSessionId (string, opsional) — lanjutan sesi clarification
 *
 * Response:
 *   - output: string — output final untuk ditampilkan ke user
 *   - tier: ComplexityTier
 *   - trace: TraceStep[] — jejak eksekusi tiap agen
 *   - totalCreditCost: number
 *   - pendingClarification?: string[]
 *   - sessionId: string — ID AgentSession untuk reference
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pre-check credit sebelum mulai pipeline.
  const balance = await getBalance(session.user.id);
  if (balance <= 0) {
    return NextResponse.json(
      {
        error:
          "Credit Anda habis. Isi ulang di /billing atau aktifkan BYOK di /settings/ai.",
      },
      { status: 402 }
    );
  }

  const body = await req.json();
  const {
    request,
    courseName,
    tutorMode,
    sourceBlock,
    webContext,
    forceTier,
    parentSessionId,
  } = body as {
    request?: string;
    courseName?: string;
    tutorMode?: string;
    sourceBlock?: string;
    webContext?: string;
    forceTier?: ComplexityTier;
    parentSessionId?: string;
  };

  if (!request?.trim()) {
    return NextResponse.json(
      { error: "Permintaan (request) wajib diisi." },
      { status: 400 }
    );
  }
  if (request.length > 6000) {
    return NextResponse.json(
      {
        error:
          "Permintaan terlalu panjang. Ringkas dulu (maksimal 6000 karakter).",
      },
      { status: 400 }
    );
  }

  await connectDB();

  // Buat AgentSession record (status=running).
  const agentSession = await AgentSession.create({
    userId: session.user.id,
    request: request.trim(),
    courseName: courseName || "",
    tutorMode: tutorMode || "helper",
    tier: forceTier || "medium", // placeholder, diupdate setelah klasifikasi
    status: "running",
    parentSessionId: parentSessionId || undefined,
  });

  // Jalankan orchestrator.
  try {
    const input: OrchestratorInput = {
      userId: session.user.id,
      request: request.trim(),
      courseName,
      tutorMode,
      sourceBlock,
      webContext,
      forceTier,
    };

    const result = await runOrchestrator(input);

    // Update AgentSession dengan hasil akhir.
    await AgentSession.findByIdAndUpdate(agentSession._id, {
      tier: result.tier,
      output: result.output,
      totalCreditCost: result.totalCreditCost,
      trace: result.trace,
      status: result.pendingClarification
        ? "clarification"
        : "completed",
      pendingClarification: result.pendingClarification || [],
      assumptions: [], // diambil dari trace clarifier bila ada
      reviewVerdict: "",
      reviewScore: 0,
    });

    return NextResponse.json({
      output: result.output,
      tier: result.tier,
      trace: result.trace,
      totalCreditCost: result.totalCreditCost,
      pendingClarification: result.pendingClarification,
      sessionId: String(agentSession._id),
    });
  } catch (err) {
    // Update session status → error.
    await AgentSession.findByIdAndUpdate(agentSession._id, {
      status: "error",
    }).catch(() => {});

    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error:
            "⚠️ Credit Anda tidak cukup untuk operasi ini. Isi ulang di menu Billing.",
        },
        { status: 402 }
      );
    }

    console.error("[agent/run] orchestrator error:", err);
    return NextResponse.json(
      {
        error:
          "Agent pipeline gagal. Silakan coba lagi. Bila berulang, hubungi support.",
      },
      { status: 500 }
    );
  }
}
