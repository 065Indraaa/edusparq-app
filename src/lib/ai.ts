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
