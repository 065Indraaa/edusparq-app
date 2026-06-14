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

/* =============================================================================
 * MULTI-MODEL ROUTER
 * -----------------------------------------------------------------------------
 * EduSparq memakai beberapa penyedia AI gratis/murah dan merutekan tiap jenis
 * tugas ke model yang paling pas — TANPA dependency npm baru (Moonshot & Gemini
 * dipanggil lewat `fetch` REST; keduanya/­Groq OpenAI-compatible).
 *
 *   - Groq   (llama-3.3-70b-versatile) : GRATIS, cepat. Default + fallback chat.
 *   - Kimi   (kimi-k2.6, Moonshot)     : BERBAYAR murah, reasoning kuat. Untuk
 *                                        tugas akurat: grading & generate soal.
 *   - Gemini (gemini-1.5-flash)        : GRATIS/murah. Untuk ringkasan & rekom.
 *
 * SEMUA panggilan graceful-degrade: kalau key provider pilihan kosong atau
 * error, otomatis jatuh ke Groq. Kalau Groq pun gagal, error dilempar ke caller
 * yang sudah punya penanganan masing-masing. TIDAK pernah mengarang jawaban.
 * ============================================================================= */

export type AiProvider = "groq" | "moonshot" | "gemini";

/** Nama model per provider, terpusat di satu tempat. */
export const PROVIDER_MODELS = {
  groq: AI_MODEL,
  moonshot: "kimi-k2.6",
  gemini: "gemini-1.5-flash",
} as const;

/** Jenis tugas AI di EduSparq. Dipakai untuk routing + budget token. */
export type AiTask =
  | "chat"
  | "summarize"
  | "flashcards"
  | "quiz"
  | "analyze"
  | "recommend"
  | "grade"
  | "draft"; // draft tulisan panjang (Studio Dokumen)

/**
 * Preferensi provider per tugas. Kalau provider utama tak tersedia (key kosong)
 * atau gagal, router otomatis fallback ke Groq.
 */
const TASK_PROVIDER: Record<AiTask, AiProvider> = {
  chat: "groq", // streaming ditangani terpisah di /api/chat
  summarize: "moonshot",
  flashcards: "groq",
  quiz: "moonshot", // butuh soal berkualitas + distraktor masuk akal
  analyze: "moonshot",
  recommend: "moonshot",
  grade: "moonshot", // penilaian akurat berbasis rubrik
  draft: "groq",
};

/** Budget token output tambahan untuk tugas baru. */
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
  /** System prompt (persona). Boleh kosong. */
  system?: string;
  /** Riwayat percakapan. Kalau hanya satu giliran, cukup pakai `user`. */
  messages?: ChatTurn[];
  /** Shortcut untuk satu pesan user (digabung dengan `system`). */
  user?: string;
  temperature?: number;
  maxTokens?: number;
  /** Minta output JSON (mengaktifkan response_format bila didukung). */
  json?: boolean;
  /** Paksa provider tertentu (mis. untuk testing). */
  forceProvider?: AiProvider;
}

export interface AiCompleteResult {
  text: string;
  provider: AiProvider;
  model: string;
}

/** Cek ketersediaan key tiap provider tanpa membocorkan nilainya. */
function providerAvailable(p: AiProvider): boolean {
  if (p === "groq") return !!process.env.GROQ_API_KEY;
  if (p === "moonshot") return !!process.env.MOONSHOT_API_KEY;
  if (p === "gemini") return !!process.env.GEMINI_API_KEY;
  return false;
}

function buildTurns(opts: AiCompleteOptions): ChatTurn[] {
  const turns: ChatTurn[] = [];
  if (opts.system) turns.push({ role: "system", content: opts.system });
  if (opts.messages && opts.messages.length > 0) {
    for (const m of opts.messages) {
      if (m.role === "system") continue; // system sudah ditambah di atas
      turns.push(m);
    }
  } else if (opts.user) {
    turns.push({ role: "user", content: opts.user });
  }
  return turns;
}

/** Panggilan OpenAI-compatible (dipakai Groq & Moonshot). */
async function openaiCompatComplete(
  baseUrl: string,
  apiKey: string,
  model: string,
  turns: ChatTurn[],
  opts: AiCompleteOptions
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages: turns,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? TASK_MAX_TOKENS[opts.task],
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${model} HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const choice = data?.choices?.[0]?.message;
  // Kimi K2.6 adalah reasoning model: jawaban final ada di `content`,
  // proses berpikir di `reasoning_content` (jangan dipakai sebagai jawaban).
  const text = (choice?.content || "").trim();
  return text;
}

/** Panggilan Gemini REST (generateContent). */
async function geminiComplete(
  apiKey: string,
  model: string,
  turns: ChatTurn[],
  opts: AiCompleteOptions
): Promise<string> {
  const systemTurns = turns.filter((t) => t.role === "system");
  const convoTurns = turns.filter((t) => t.role !== "system");
  const body: Record<string, unknown> = {
    contents: convoTurns.map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.content }],
    })),
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? TASK_MAX_TOKENS[opts.task],
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (systemTurns.length > 0) {
    body.systemInstruction = {
      parts: [{ text: systemTurns.map((t) => t.content).join("\n\n") }],
    };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${model} HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((p: { text?: string }) => p?.text || "").join("").trim()
    : "";
  return text;
}

async function runProvider(
  provider: AiProvider,
  turns: ChatTurn[],
  opts: AiCompleteOptions
): Promise<string> {
  if (provider === "groq") {
    return openaiCompatComplete(
      "https://api.groq.com/openai/v1",
      process.env.GROQ_API_KEY!,
      PROVIDER_MODELS.groq,
      turns,
      opts
    );
  }
  if (provider === "moonshot") {
    return openaiCompatComplete(
      "https://api.moonshot.ai/v1",
      process.env.MOONSHOT_API_KEY!,
      PROVIDER_MODELS.moonshot,
      turns,
      opts
    );
  }
  // gemini
  return geminiComplete(
    process.env.GEMINI_API_KEY!,
    PROVIDER_MODELS.gemini,
    turns,
    opts
  );
}

/**
 * Entry point terpusat untuk SEMUA panggilan AI non-streaming di EduSparq.
 * Memilih provider sesuai jenis tugas, dengan fallback otomatis ke Groq.
 *
 * Contoh:
 *   const { text } = await aiComplete({ task: "grade", system, user, json: true });
 */
export async function aiComplete(
  opts: AiCompleteOptions
): Promise<AiCompleteResult> {
  const turns = buildTurns(opts);
  const primary = opts.forceProvider || TASK_PROVIDER[opts.task];

  // Urutan percobaan: provider utama (bila ada key) → Groq sebagai fallback.
  const order: AiProvider[] = [];
  if (providerAvailable(primary)) order.push(primary);
  if (primary !== "groq" && providerAvailable("groq")) order.push("groq");
  if (order.length === 0) {
    throw new Error(
      "Tidak ada penyedia AI yang terkonfigurasi (cek GROQ_API_KEY)."
    );
  }

  let lastErr: unknown = null;
  for (const provider of order) {
    try {
      const text = await runProvider(provider, turns, opts);
      if (text) return { text, provider, model: PROVIDER_MODELS[provider] };
      lastErr = new Error(`${provider} mengembalikan respons kosong`);
    } catch (err) {
      lastErr = err;
      // lanjut ke provider berikutnya (fallback)
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Semua penyedia AI gagal merespons.");
}