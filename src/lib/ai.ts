import { complete, type CompleteOptions, type CompleteResult } from "./ai-client";
import { PLATFORM_AI } from "./credit-config";
import type { FeatureName } from "./credit-config";

/**
 * Centralized AI configuration (legacy compat layer).
 *
 * ⚠️  File ini dipertahankan untuk kompatibilitas mundur. Semua panggilan baru
 *     SEBAIKNYA pakai `complete()` / `streamComplete()` dari `@/lib/ai-client`
 *     yang sudah terintegrasi metering + billing + BYOK.
 *
 * Fungsi `aiComplete()` di sini adalah thin wrapper: tetap memakai platform
 * default (tidak BYOK) dan TIDAK memotong credit (untuk fitur lama yang belum
 * migrasi). Fitur yang sudah migrasi wajib pakai `complete(opts, userId)`.
 */

// Re-export agar import lama (`import { AI_MODEL } from "@/lib/ai"`) tetap jalan.
export const AI_MODEL = PLATFORM_AI.model;

export const RAG_CONTEXT_CHARS = 12000;
export const RAG_CHUNK_LIMIT = 24;
export const AI_MAX_TOKENS = {
  chat: 1024,
  summarize: 2048,
  flashcards: 2048,
  quiz: 3072,
  analyze: 2048,
  recommend: 1536,
  grade: 1200,
} as const;

/**
 * Defensive JSON parse for LLM output: strips ```json fences and locates the
 * first `[` or `{`. Returns null instead of throwing on malformed output.
 */
export function parseLooseJSON<T = unknown>(raw: string): T | null {
  try {
    const cleaned = (raw || "")
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    const firstArr = cleaned.indexOf("[");
    const firstObj = cleaned.indexOf("{");
    const candidates = [firstArr, firstObj].filter((i) => i >= 0);
    if (candidates.length === 0) return null;
    const start = Math.min(...candidates);
    return JSON.parse(cleaned.slice(start)) as T;
  } catch {
    return null;
  }
}

export type AiProvider = "moonshot";
export const PROVIDER_MODELS = { moonshot: AI_MODEL } as const;

export type AiTask =
  | "chat"
  | "summarize"
  | "flashcards"
  | "quiz"
  | "analyze"
  | "recommend"
  | "grade"
  | "draft";

const TASK_PROVIDER: Record<AiTask, AiProvider> = {
  chat: "moonshot",
  summarize: "moonshot",
  flashcards: "moonshot",
  quiz: "moonshot",
  analyze: "moonshot",
  recommend: "moonshot",
  grade: "moonshot",
  draft: "moonshot",
};

export const TASK_MAX_TOKENS: Record<AiTask, number> = {
  chat: AI_MAX_TOKENS.chat,
  summarize: 2048,
  flashcards: AI_MAX_TOKENS.flashcards,
  quiz: AI_MAX_TOKENS.quiz,
  analyze: 2048,
  recommend: 1536,
  grade: AI_MAX_TOKENS.grade,
  draft: 4096,
};

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompleteOptions {
  task: AiTask;
  system?: string;
  messages?: ChatTurn[];
  user?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}

export interface AiCompleteResult {
  text: string;
  provider: AiProvider;
  model: string;
}

/**
 * Legacy wrapper. Tidak menerima userId → selalu pakai platform default &
 * TIDAK memotong credit (fitur lama). Untuk pemanggilan yang harus ter-bill,
 * pakai `complete({feature, ...}, userId)` dari ai-client.
 */
export async function aiComplete(
  opts: AiCompleteOptions
): Promise<AiCompleteResult> {
  const feature = taskToFeature(opts.task);
  const result = await complete({
    feature,
    system: opts.system,
    messages: opts.messages as CompleteOptions["messages"],
    user: opts.user,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    json: opts.json,
    // Tidak kirim userId → pakai platform, tidak billing.
  });
  return { text: result.text, provider: "moonshot", model: result.model };
}

/** Pemetaan AiTask (lama) → FeatureName (baru) untuk metering. */
function taskToFeature(task: AiTask): FeatureName {
  const map: Record<AiTask, FeatureName> = {
    chat: "chat",
    summarize: "summarize",
    flashcards: "flashcards",
    quiz: "quiz",
    analyze: "analyze",
    recommend: "recommend",
    grade: "grade",
    draft: "draft",
  };
  return map[task] || "chat";
}
