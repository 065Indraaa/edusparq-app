import Groq from "groq-sdk";

/**
 * Centralized AI configuration.
 *
 * IMPORTANT: Groq decommissions models periodically. As of 2026 the old
 * `llama3-70b-8192` is GONE (returns 400 "model has been decommissioned").
 * Keep the active model in ONE place so a future swap is a one-line change.
 *
 * `llama-3.3-70b-versatile` — current flagship 70B on Groq, 131k context window.
 */
export const AI_MODEL = "llama-3.3-70b-versatile";

/**
 * Centralized token budget. Tuning these in ONE place keeps Groq usage lean
 * without hurting answer quality:
 *  - RAG_CONTEXT_CHARS: cap on retrieved context fed to the model (~4 chars/token,
 *    so 12k chars ≈ 3k input tokens — plenty to ground summaries/quiz/flashcards on
 *    a typical lecture doc, vs the old 24k that doubled input cost for little gain).
 *  - RAG_CHUNK_LIMIT: how many chunks to pull from Mongo before slicing (24 × ~500
 *    chars ≈ the context cap, so we don't fetch chunks we'd only throw away).
 *  - AI_MAX_TOKENS: per-task output ceilings so no call runs away on output tokens.
 */
export const RAG_CONTEXT_CHARS = 12000;
export const RAG_CHUNK_LIMIT = 24;
export const AI_MAX_TOKENS = {
  chat: 1024,
  summarize: 1536,
  flashcards: 2048,
  quiz: 3072,
  analyze: 1536,
  recommend: 1024,
  grade: 1200,
} as const;

let groqClient: Groq | null = null;

/** Lazy Groq client singleton. Throws a clear error if the key is missing. */
export const getGroqClient = (): Groq => {
  if (!groqClient) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY belum diisi di environment.");
    }
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
};

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
