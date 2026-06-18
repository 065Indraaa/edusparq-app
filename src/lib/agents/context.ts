import type { FeatureName } from "@/lib/credit-config";

/**
 * SessionContext — state bersama yang mengalir antar agen.
 *
 * Setiap agen MEMBACA dari context ini dan MENULIS hasilnya kembali, sehingga
 * rantai agen berbagi pemahaman (tujuan, batasan, hasil per tahap) tanpa
 * mengulang seluruh prompt dari nol — inilah kunci hemat token.
 */
export interface SessionContext {
  /** ID user (untuk billing + BYOK + persona). */
  userId: string;
  /** Permintaan asli user, apa adanya. */
  request: string;
  /** Mata kuliah / konteks akademik (opsional). */
  courseName?: string;
  /** Persona tutor yang dipilih user (helper/socratic/research/dll). */
  tutorMode?: string;
  /** Dokumen/material grounding (RAG chunks sudah dipangkas). */
  sourceBlock?: string;
  /** Hasil web search (opsional). */
  webContext?: string;
  /** Profil singkat user untuk personalisasi. */
  personaMemory?: string;
  /** Jurusan-specific prompt context (diinjeksi dari jurusan-catalog). */
  jurusanPromptExtra?: string;
  /** Profil kampus user (untuk personalisasi AI response). */
  studentProfile?: { university?: string; faculty?: string; major?: string; semester?: number };

  // ─── Output tiap tahap (diisi bertahap oleh agen) ────────────────────────
  /** Klasifikasi kompleksitas dari orchestrator. */
  classification?: ComplexityTier;
  /** Pertanyaan klarifikasi (bila ada ambiguitas). */
  clarifierQuestions?: string[];
  /** Asumsi yang diambil bila user tidak menjawab klarifikasi. */
  assumptions?: string[];
  /** Spec teknis dari Spesifier. */
  specification?: string;
  /** Rencana langkah dari Planner. */
  plan?: PlanStep[];
  /** Daftar task atomic dari Tasker. */
  tasks?: AgentTask[];
  /** Output final dari Implementer. */
  result?: string;
  /** Verdict + revisi dari Reviewer. */
  review?: ReviewResult;
  /** Trace jejak eksekusi (untuk UI stepper). */
  trace: TraceStep[];
}

export type ComplexityTier = "simple" | "medium" | "complex";

export interface PlanStep {
  title: string;
  detail: string;
  order: number;
}

export interface AgentTask {
  title: string;
  description: string;
  agent: AgentName;
  order: number;
}

export interface ReviewResult {
  verdict: "approve" | "revise";
  qualityScore: number; // 0-100
  issues: string[];
  strengths: string[];
  revisedOutput?: string;
}

export interface TraceStep {
  agent: AgentName;
  startedAt: string;
  finishedAt?: string;
  status: "pending" | "running" | "done" | "skipped" | "error";
  /** Ringkasan output (untuk ditampilkan di UI, bukan full). */
  summary?: string;
  creditCost?: number;
  tokensOut?: number;
  error?: string;
}

/** Nama agen yang terdaftar di registry. */
export type AgentName =
  | "classifier"
  | "clarifier"
  | "specifier"
  | "planner"
  | "tasker"
  | "implementer"
  | "reviewer"
  | "helper"; // helper = passthrough untuk jalur simple (tanpa sub-agen)

/** Buat context baru untuk satu sesi. */
export function createSession(input: {
  userId: string;
  request: string;
  courseName?: string;
  tutorMode?: string;
  sourceBlock?: string;
  webContext?: string;
  personaMemory?: string;
}): SessionContext {
  return {
    userId: input.userId,
    request: input.request,
    courseName: input.courseName,
    tutorMode: input.tutorMode,
    sourceBlock: input.sourceBlock,
    webContext: input.webContext,
    personaMemory: input.personaMemory,
    trace: [],
  };
}

/** Tambah langkah trace (dipakai oleh runner). */
export function pushTrace(
  ctx: SessionContext,
  step: TraceStep
): void {
  ctx.trace.push(step);
}

/** Update langkah trace terakhir berdasarkan agent name. */
export function finishTrace(
  ctx: SessionContext,
  agent: AgentName,
  patch: Partial<TraceStep>
): void {
  // Cari langkah terakhir untuk agent ini yang masih running/pending.
  for (let i = ctx.trace.length - 1; i >= 0; i--) {
    if (ctx.trace[i].agent === agent && ctx.trace[i].status === "running") {
      ctx.trace[i] = {
        ...ctx.trace[i],
        finishedAt: new Date().toISOString(),
        status: "done",
        ...patch,
      };
      return;
    }
  }
}
