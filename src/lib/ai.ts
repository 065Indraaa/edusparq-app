import Groq from "groq-sdk";

/**
 * Centralized AI configuration.
 *
 * EduSparq is now configured to exclusively use Kimi (Moonshot)
 * via the Kimchi Dev base URL.
 */
export const AI_MODEL = "kimi-k2.6";

/**
 * Centralized token budget.
 */
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

let kimiClient: Groq | null = null;

/** Lazy Kimi client singleton (using Groq SDK wrapper for OpenAI compatibility). */
export const getKimiClient = (): Groq => {
  if (!kimiClient) {
    if (!process.env.MOONSHOT_API_KEY) {
      throw new Error("MOONSHOT_API_KEY belum diisi di environment.");
    }
    kimiClient = new Groq({ 
      apiKey: process.env.MOONSHOT_API_KEY,
      baseURL: "https://www.phanrouter.com/phanrouter/v1"
    });
  }
  return kimiClient;
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

/* =============================================================================
 * EXCLUSIVE KIMI ROUTER
 * -----------------------------------------------------------------------------
 * EduSparq sekarang eksklusif memakai Kimi (Moonshot) untuk semua jenis tugas.
 * Tidak ada fallback ke Groq atau Gemini.
 * ============================================================================= */

export type AiProvider = "moonshot";

export const PROVIDER_MODELS = {
  moonshot: AI_MODEL,
} as const;

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

function buildTurns(opts: AiCompleteOptions): ChatTurn[] {
  const turns: ChatTurn[] = [];
  if (opts.system) turns.push({ role: "system", content: opts.system });
  if (opts.messages && opts.messages.length > 0) {
    for (const m of opts.messages) {
      if (m.role === "system") continue;
      turns.push(m);
    }
  } else if (opts.user) {
    turns.push({ role: "user", content: opts.user });
  }
  return turns;
}

async function kimiComplete(
  turns: ChatTurn[],
  opts: AiCompleteOptions
): Promise<string> {
  const body: Record<string, unknown> = {
    model: AI_MODEL,
    messages: turns,
    temperature: opts.temperature ?? 0.3, // lowered temperature for professional/factual output
    max_tokens: opts.maxTokens ?? TASK_MAX_TOKENS[opts.task],
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch("https://www.phanrouter.com/phanrouter/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Kimi HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const choice = data?.choices?.[0]?.message;
  // Kimi K2.6 reasoning fallback
  const text = (choice?.content || "").trim();
  return text;
}

export async function aiComplete(
  opts: AiCompleteOptions
): Promise<AiCompleteResult> {
  const turns = buildTurns(opts);
  if (!process.env.MOONSHOT_API_KEY) {
    throw new Error("MOONSHOT_API_KEY belum dikonfigurasi.");
  }

  try {
    const text = await kimiComplete(turns, opts);
    if (text) return { text, provider: "moonshot", model: AI_MODEL };
    throw new Error("Kimi mengembalikan respons kosong");
  } catch (err) {
    throw err instanceof Error ? err : new Error("Kimi gagal merespons.");
  }
}