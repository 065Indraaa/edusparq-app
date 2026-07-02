import "./definitions"; // registrasikan semua agen saat import
import { runAgent, listAgents, getAgent } from "./registry";
import {
  parseClassifierOutput,
  parseClarifierOutput,
  parsePlannerOutput,
  parseTaskerOutput,
  parseReviewerOutput,
} from "./definitions";
import { complete, completeWithTools } from "../../lib/ai-client";
import { buildSystemPrompt, personaFromMode } from "../../lib/ai-prompts";
import { getUserPersonaContext } from "../../lib/ai-memory";
import { buildJurusanAwareContext } from "../../lib/jurusan-context";
import { buildMemoryContext } from "../../lib/memory-engine";
import type { SessionContext, ComplexityTier } from "./context";
import { createSession } from "./context";

/**
 * Orchestrator — router pintar multi-agen on-demand.
 *
 * Pilihan user: "Orchestrator + sub-agen on-demand" (paling hemat token).
 *
 * Jalur eksekusi:
 *   - simple   → helper (1 call) — definisi/fakta/jelaskan.
 *   - medium   → clarifier → implementer (2 call) — penjelasan menengah.
 *   - complex  → classifier → clarifier → specifier → planner → tasker
 *                → implementer → reviewer (6-7 call) — tugas besar/solver.
 *
 * Klasifikasi pakai heuristic rule-based DULU (gratis), baru AI classifier
 * bila heuristic ambigu — hemat token. Persona tutor (helper/socratic/dll)
 * tetap dihormati di implementer & helper.
 *
 * Fungsi ini NON-STREAMING. Untuk chat realtime, pakai orchestratorStream().
 */

export interface OrchestratorInput {
  userId: string;
  request: string;
  courseName?: string;
  tutorMode?: string;
  sourceBlock?: string;
  webContext?: string;
  /** Override mode: auto (default, klasifikasi otomatis) atau simple/medium/complex. */
  forceTier?: ComplexityTier;
  /** Callback progres untuk UI stepper. */
  onProgress?: (agent: string, status: string, summary?: string) => void;
}

export interface OrchestratorResult {
  output: string;
  tier: ComplexityTier;
  trace: SessionContext["trace"];
  totalCreditCost: number;
  /** Bila clarifier butuh input user (interactive), ini diisi. */
  pendingClarification?: string[];
}

/** Flag agar sistem agen dimuat (definitions.ts side-effect). */
export const agentsReady = () => listAgents().length > 0;

/**
 * Klasifikasi HEURISTIC gratis (rule-based). Dipakai pertama untuk hemat token.
 * Hanya panggil AI classifier bila hasil heuristic = "ambiguous".
 */
function heuristicClassify(request: string): ComplexityTier | "ambiguous" {
  const r = request.toLowerCase().trim();
  if (!r) return "simple";

  // Sinyal COMPLEX: kata kerja tugas berat, dokumen panjang, multi-output.
  const complexSignals = [
    "buatkan", "kerjakan", "selesaikan", "susun", "rancang", "analisis lengkap",
    "bab 1", "bab 2", "bab 3", "bab 4", "bab 5", "makalah", "skripsi", "tesis",
    "proposal", "erd", "prd", "use case", "arsitektur", "coding", "program",
    "source code", "studi kasus", "laporan praktikum", "rangkuman dari",
    "artikel ilmiah", "step by step", "langkah-langkah",
  ];
  // Sinyal SIMPLE: pertanyaan definisi/fakta singkat.
  const simpleSignals = [
    "apa itu", "apa yang dimaksud", "jelaskan singkat", "siapa", "kapan",
    "definisi", "pengertian", "fungsi dari", "kepanjangan", "apa sih",
  ];

  const len = r.length;
  const hasComplex = complexSignals.some((s) => r.includes(s));
  const hasSimple = simpleSignals.some((s) => r.includes(s));

  if (hasComplex && len > 120) return "complex";
  if (hasComplex) return "complex";
  if (hasSimple && len < 200) return "simple";
  if (len < 80) return "simple";
  if (len > 400) return "complex"; // permintaan panjang → biasanya kompleks
  return "ambiguous";
}

export async function runOrchestrator(
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  const ctx: SessionContext = createSession({
    userId: input.userId,
    request: input.request,
    courseName: input.courseName,
    tutorMode: input.tutorMode,
    sourceBlock: input.sourceBlock,
    webContext: input.webContext,
  });

  // Ambil persona memory sekali (dipakai di helper & implementer).
  try {
    ctx.personaMemory = await getUserPersonaContext(input.userId);
  } catch {
    /* non-fatal */
  }

  // Ambil jurusan-aware context (non-blocking).
  try {
    const { studentContext, jurusanPromptExtra } = await buildJurusanAwareContext(input.userId, {
      courseName: input.courseName,
    });
    ctx.jurusanPromptExtra = jurusanPromptExtra || undefined;
    ctx.studentProfile = studentContext.university || studentContext.faculty || studentContext.major
      ? { university: studentContext.university, faculty: studentContext.faculty, major: studentContext.major, semester: studentContext.semester }
      : undefined;
  } catch {
    /* non-fatal — jurusan context is enhancement, not requirement */
  }

  // 1. Tentukan tier.
  let tier: ComplexityTier;
  if (input.forceTier) {
    tier = input.forceTier;
  } else {
    const heuristic = heuristicClassify(input.request);
    if (heuristic !== "ambiguous") {
      tier = heuristic;
    } else {
      // Ambigu → panggil AI classifier (1 call kecil, model lite).
      input.onProgress?.("classifier", "running");
      const { output, error } = await runAgent("classifier", ctx);
      if (error || !output) {
        tier = "medium"; // fallback aman
      } else {
        tier = parseClassifierOutput(output).tier;
      }
      input.onProgress?.("classifier", "done", tier);
    }
  }
  ctx.classification = tier;

  // 2. Eksekusi sesuai tier.
  let output = "";

  if (tier === "simple") {
    // Jalur SIMPLE: helper langsung (persona tutor dipertahankan).
    output = await runHelper(ctx, input.onProgress);
  } else if (tier === "medium") {
    // Jalur MEDIUM: clarifier → implementer.
    const clar = await runClarifier(ctx, input.onProgress);
    if (clar?.needsClarification && clar.questions.length > 0) {
      // Interactive: kembalikan pertanyaan ke user, jangan lanjut.
      return {
        output: formatClarificationMessage(clar.questions, clar.assumptions),
        tier,
        trace: ctx.trace,
        totalCreditCost: sumCost(ctx.trace),
        pendingClarification: clar.questions,
      };
    }
    ctx.assumptions = clar?.assumptions || [];
    output = await runImplementer(ctx, input.onProgress);
  } else {
    // Jalur COMPLEX: full pipeline.
    const clar = await runClarifier(ctx, input.onProgress);
    if (clar?.needsClarification && clar.questions.length > 0) {
      return {
        output: formatClarificationMessage(clar.questions, clar.assumptions),
        tier,
        trace: ctx.trace,
        totalCreditCost: sumCost(ctx.trace),
        pendingClarification: clar.questions,
      };
    }
    ctx.assumptions = clar?.assumptions || [];

    await runSpecifier(ctx, input.onProgress);
    await runPlanner(ctx, input.onProgress);
    await runTasker(ctx, input.onProgress);
    const impl = await runImplementer(ctx, input.onProgress);
    const reviewed = await runReviewer(ctx, impl, input.onProgress);
    output = reviewed;
  }

  return {
    output,
    tier,
    trace: ctx.trace,
    totalCreditCost: sumCost(ctx.trace),
  };
}

// ─── Helper sub-routines tiap agen (dengan parse + tulis context) ────────────

async function runHelper(
  ctx: SessionContext,
  onProgress?: (a: string, s: string, sum?: string) => void
): Promise<string> {
  onProgress?.("helper", "running");
  const persona = personaFromMode(ctx.tutorMode);
  const studentCtx: { sourceBlock?: string; courses?: string[]; name?: string; university?: string; faculty?: string; major?: string; semester?: number } = {
    sourceBlock: ctx.sourceBlock,
    courses: ctx.courseName ? [ctx.courseName] : undefined,
    university: ctx.studentProfile?.university,
    faculty: ctx.studentProfile?.faculty,
    major: ctx.studentProfile?.major,
    semester: ctx.studentProfile?.semester,
  };
  let system = buildSystemPrompt(persona, studentCtx);
  if (ctx.personaMemory) system = ctx.personaMemory + system;
  if (ctx.jurusanPromptExtra) system += "\n\n" + ctx.jurusanPromptExtra;

  // Build memory context (per-user knowledge graph)
  try {
    const memoryCtx = await buildMemoryContext(ctx.userId, ctx.request);
    if (memoryCtx.contextBlock) system += memoryCtx.contextBlock;
  } catch {
    /* non-fatal — memory is enhancement */
  }

  // Heuristic: should we use tools?
  const r = ctx.request.toLowerCase();
  const toolSignals = ["cari", "berapa", "kapan", "mana", "jurnal", "referensi", "materi", "tugas", "deadline", "tenggat", "jadwal", "nilai", "ipk", "cari tau", "carikan"];
  const useTools = toolSignals.some((s) => r.includes(s)) || ctx.tutorMode === "research";

  try {
    let result;
    if (useTools) {
      result = await completeWithTools(
        {
          feature: "chat",
          system,
          user: ctx.request,
          temperature: 0.4,
          maxTokens: 1200,
          taskId: ctx.request.slice(0, 40) + ":helper",
        },
        ctx.userId,
        true
      );
    } else {
      const res = await complete(
        {
          feature: "chat",
          system,
          user: ctx.request,
          temperature: 0.4,
          maxTokens: 1200,
          taskId: ctx.request.slice(0, 40) + ":helper",
        },
        ctx.userId
      );
      result = { ...res, toolsUsed: [], sources: [] };
    }

    ctx.trace.push({
      agent: "helper",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: "done",
      creditCost: result.creditCost,
      tokensOut: result.tokensOut,
      summary: result.text.slice(0, 240),
    });
    onProgress?.("helper", "done", result.text.slice(0, 100));
    return result.text;
  } catch (err) {
    ctx.trace.push({
      agent: "helper",
      startedAt: new Date().toISOString(),
      status: "error",
      error: err instanceof Error ? err.message.slice(0, 200) : "gagal",
    });
    onProgress?.("helper", "error");
    throw err;
  }
}

async function runClarifier(
  ctx: SessionContext,
  onProgress?: (a: string, s: string, sum?: string) => void
) {
  onProgress?.("clarifier", "running");
  const { output, error } = await runAgent("clarifier", ctx);
  onProgress?.("clarifier", "done", output.slice(0, 100));
  if (error || !output) return null;
  const parsed = parseClarifierOutput(output);
  ctx.clarifierQuestions = parsed.questions;
  ctx.assumptions = parsed.assumptions;
  return parsed;
}

async function runSpecifier(
  ctx: SessionContext,
  onProgress?: (a: string, s: string, sum?: string) => void
) {
  onProgress?.("specifier", "running");
  const { output } = await runAgent("specifier", ctx);
  onProgress?.("specifier", "done", output.slice(0, 100));
  ctx.specification = output || ctx.specification;
}

async function runPlanner(
  ctx: SessionContext,
  onProgress?: (a: string, s: string, sum?: string) => void
) {
  onProgress?.("planner", "running");
  const { output } = await runAgent("planner", ctx);
  onProgress?.("planner", "done", output.slice(0, 100));
  ctx.plan = parsePlannerOutput(output);
}

async function runTasker(
  ctx: SessionContext,
  onProgress?: (a: string, s: string, sum?: string) => void
) {
  onProgress?.("tasker", "running");
  const { output } = await runAgent("tasker", ctx);
  onProgress?.("tasker", "done", output.slice(0, 100));
  ctx.tasks = parseTaskerOutput(output);
}

async function runImplementer(
  ctx: SessionContext,
  onProgress?: (a: string, s: string, sum?: string) => void
): Promise<string> {
  onProgress?.("implementer", "running");
  // Complex tier: enable tools (RAG, jurnal, web search, KBBI, legal)
  // agar implementer bisa cari referensi real, bukan mengarang.
  try {
    const def = getAgent("implementer");
    if (def) {
      const system = def.buildPrompt(ctx);
      const userPayload = `[SPESIFIKASI]\n${ctx.specification || ""}\n\n[RENCANA & TASK]\n${(ctx.tasks || [])
        .map((t) => `${t.order}. [${t.agent}] ${t.title}: ${t.description}`)
        .join("\n")}\n\n[PERMINTAAN ASLI]\n${ctx.request}`;
      const result = await completeWithTools(
        {
          feature: "agent_implementer",
          system,
          user: userPayload,
          temperature: 0.6,
          maxTokens: 3000,
          taskId: ctx.request.slice(0, 40) + ":implementer",
        },
        ctx.userId,
        true // enable tools
      );
      const output = result.text || "";
      onProgress?.("implementer", "done", output.slice(0, 100));
      ctx.result = output;
      if (result.toolsUsed && result.toolsUsed.length > 0) {
        ctx.trace.push({
          agent: "implementer",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          status: "done",
          summary: `Tools digunakan: ${result.toolsUsed.join(", ")}`,
          creditCost: 0,
          tokensOut: 0,
        });
      }
      return output;
    }
  } catch (err) {
    console.warn("[orchestrator] implementer with tools failed, fallback:", err);
  }
  // Fallback: plain runAgent (no tools).
  const { output, error } = await runAgent("implementer", ctx);
  onProgress?.("implementer", "done", output.slice(0, 100));
  if (error) throw new Error("Implementer gagal: " + error);
  ctx.result = output;
  return output;
}

async function runReviewer(
  ctx: SessionContext,
  implOutput: string,
  onProgress?: (a: string, s: string, sum?: string) => void
): Promise<string> {
  onProgress?.("reviewer", "running");
  const { output, error } = await runAgent("reviewer", ctx);
  if (error || !output) {
    // Reviewer gagal → kembalikan output implementer apa adanya (graceful).
    onProgress?.("reviewer", "skipped");
    return implOutput;
  }
  const parsed = parseReviewerOutput(output);
  ctx.review = {
    verdict: parsed.verdict,
    qualityScore: parsed.qualityScore,
    issues: parsed.issues,
    strengths: parsed.strengths,
    revisedOutput: parsed.revisedOutput,
  };
  onProgress?.(
    "reviewer",
    "done",
    `${parsed.verdict} (${parsed.qualityScore})`
  );
  // Bila reviewer revisi & ada output revisi → pakai revisi. Else pertahankan implementer.
  return parsed.verdict === "revise" && parsed.revisedOutput
    ? parsed.revisedOutput
    : implOutput;
}

function sumCost(trace: SessionContext["trace"]): number {
  return trace.reduce((n, s) => n + (s.creditCost || 0), 0);
}

function formatClarificationMessage(
  questions: string[],
  assumptions: string[]
): string {
  let msg = "Sebelum saya kerjakan, saya butuh sedikit kejelasan agar hasilnya tepat:\n\n";
  questions.forEach((q, i) => {
    msg += `${i + 1}. ${q}\n`;
  });
  if (assumptions.length > 0) {
    msg += `\n_(Sementara ini saya asumsikan: ${assumptions.join("; ")}. Jawab pertanyaan di atas atau ketik "lanjut" untuk pakai asumsi ini.)_`;
  } else {
    msg += `\n_(Balas dengan jawaban, atau ketik "lanjut" untuk saya kerjakan dengan asumsi standar.)_`;
  }
  return msg;
}
