import OpenAI from "openai";
import { connectDB } from "./db/mongodb";
import { ApiKey } from "./db/models/ApiKey";
import { User } from "./db/models/User";
import { UsageLog } from "./db/models/UsageLog";
import { decryptSecret } from "./crypto";
import { PLATFORM_AI, computeCost, estimateTokens, type FeatureName } from "./credit-config";
import { deductCredits, refundCredits, getBalance, canAfford } from "./credit-billing";

/**
 * AI Client — resolver universal untuk semua pemanggilan AI EduSparq.
 *
 * Prioritas resolve kredensial:
 *   1. BYOK aktif (user.byokEnabled + ada ApiKey active) → pakai kunci user.
 *      - TIDAK memotong credit EduSparq (gratis buat user).
 *      - Tetap di-metering di UsageLog (source="byok") untuk statistik.
 *   2. Default platform (Kimi/Moonshot via env) → potong credit.
 *
 * Semua panggilan non-streaming SEHARUSNYA lewat `complete()` agar metering &
 * billing konsisten. Untuk streaming, pakai helper `streamComplete()`.
 */

export interface ResolvedClient {
  client: OpenAI;
  baseURL: string;
  model: string;
  /** Sumber kunci: platform (potong credit) atau byok (gratis buat user). */
  source: "platform" | "byok";
  apiKeyId?: string;
}

/**
 * Meresolve klien AI untuk user. User ID opsional untuk pemanggilan sistem
 * (mis. cron, telegram anonim) → fallback ke platform default.
 */
export async function resolveClient(userId?: string): Promise<ResolvedClient> {
  // Cek BYOK.
  if (userId) {
    try {
      await connectDB();
      const user = await User.findById(userId).lean();
      if (user?.byokEnabled) {
        const key = await ApiKey.findOne({ userId, active: true }).lean();
        if (key?.encryptedKey) {
          const apiKey = decryptSecret(key.encryptedKey);
          return {
            client: new OpenAI({ apiKey, baseURL: key.baseURL }),
            baseURL: key.baseURL,
            model: key.model || "gpt-4o-mini",
            source: "byok",
            apiKeyId: String(key._id),
          };
        }
      }
    } catch (err) {
      console.warn("[ai-client] resolve BYOK gagal, fallback platform:", err);
    }
  }

  // Default platform.
  const apiKey = process.env[PLATFORM_AI.apiKeyEnv];
  if (!apiKey) {
    throw new Error(
      `${PLATFORM_AI.apiKeyEnv} belum dikonfigurasi di environment, dan user belum set BYOK.`
    );
  }
  return {
    client: new OpenAI({ apiKey, baseURL: PLATFORM_AI.baseURL }),
    baseURL: PLATFORM_AI.baseURL,
    model: PLATFORM_AI.model,
    source: "platform",
  };
}

export interface Turn {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  /** Identifikasi fitur untuk metering & bobot credit. */
  feature: FeatureName;
  system?: string;
  messages?: Turn[];
  user?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  /** Override model (mis. pakai lite model untuk klasifikasi). */
  model?: string;
  /** Identifikasi sesi agent/trace. */
  taskId?: string;
}

export interface CompleteResult {
  text: string;
  model: string;
  source: "platform" | "byok";
  /** Biaya credit yang dipotong (0 bila BYOK atau gagal log). */
  creditCost: number;
  tokensIn: number;
  tokensOut: number;
  estimated: boolean;
}

/**
 * Pemanggilan AI non-streaming dengan metering + billing otomatis.
 *
 * Alur:
 *   1. Resolve client (BYOK atau platform).
 *   2. Bila platform → pre-check saldo cukup (estimasi dari maxTokens).
 *      Bila kurang → lempar error khusus InsufficientCreditsError.
 *   3. Panggil AI.
 *   4. Hitung token aktual dari response.usage (atau estimasi bila tidak ada).
 *   5. Bila platform → deductCredits atomic + log.
 *   6. Bila BYOK → log saja (source="byok", creditCost=0).
 *
 * Bila AI gagal setelah pre-deduct → refund otomatis.
 */
export async function complete(
  opts: CompleteOptions,
  userId?: string
): Promise<CompleteResult> {
  const resolved = await resolveClient(userId);
  const model = opts.model || resolved.model;

  // Susun turns.
  const turns: Turn[] = [];
  if (opts.system) turns.push({ role: "system", content: opts.system });
  if (opts.messages?.length) {
    for (const m of opts.messages) {
      if (m.role === "system") continue;
      turns.push(m);
    }
  } else if (opts.user) {
    turns.push({ role: "user", content: opts.user });
  }

  // Pre-check saldo untuk platform (estimasi biaya maksimal dari maxTokens).
  if (resolved.source === "platform" && userId) {
    const estOut = opts.maxTokens || 1024;
    const estIn = turns.reduce((n, t) => n + estimateTokens(t.content), 0);
    const est = computeCost(opts.feature, estIn, estOut, true);
    const affordable = await canAfford(userId, est.creditCost);
    if (!affordable) {
      throw new InsufficientCreditsError(est.creditCost, await getBalance(userId));
    }
  }

  // Eksekusi.
  const body: Record<string, unknown> = {
    model,
    messages: turns,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1024,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  let tokensIn = 0;
  let tokensOut = 0;
  let estimated = false;
  let text = "";

  try {
    const resp = await resolved.client.chat.completions.create(body as any);
    text = (resp.choices?.[0]?.message?.content || "").trim();
    const usage = (resp as any).usage;
    if (usage && typeof usage.prompt_tokens === "number") {
      tokensIn = usage.prompt_tokens;
      tokensOut = usage.completion_tokens || estimateTokens(text);
    } else {
      // Provider tidak kembalikan usage → estimasi.
      tokensIn = estimateTokens(turns.map((t) => t.content).join("\n"));
      tokensOut = estimateTokens(text);
      estimated = true;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI gagal merespons";
    // Log kegagalan untuk monitoring.
    if (userId) {
      try {
        await UsageLog.create({
          userId,
          feature: opts.feature,
          taskId: opts.taskId || "",
          source: resolved.source,
          model,
          tokensIn: 0,
          tokensOut: 0,
          creditCost: 0,
          status: "error",
          error: msg.slice(0, 300),
        });
      } catch {}
    }
    throw err;
  }

  // Metering + billing.
  const cost = computeCost(opts.feature, tokensIn, tokensOut, estimated);
  let creditCost = 0;

  if (resolved.source === "platform" && userId) {
    const deduction = await deductCredits(userId, cost.creditCost, {
      feature: opts.feature,
      txnNote: opts.feature,
      tokensIn,
      tokensOut,
      model,
      source: "platform",
      estimated,
      taskId: opts.taskId,
    });
    creditCost = deduction.charged;
    if (!deduction.ok) {
      // Race condition: saldo berubah setelah pre-check. Output tetap diberikan
      // ( UX lebih baik) tapi ditandai tidak terpotong penuh.
      console.warn("[ai-client] saldo tidak cukup saat post-deduct untuk", userId);
    }
  } else if (resolved.source === "byok" && userId) {
    // BYOK: log saja, tidak potong credit.
    try {
      await UsageLog.create({
        userId,
        feature: opts.feature,
        taskId: opts.taskId || "",
        source: "byok",
        model,
        tokensIn,
        tokensOut,
        estimated,
        creditCost: 0,
        status: "ok",
      });
    } catch {}
    creditCost = 0;
  }

  return {
    text,
    model,
    source: resolved.source,
    creditCost,
    tokensIn,
    tokensOut,
    estimated,
  };
}

/**
 * Error khusus saldo credit kurang. Endpoint bisa catch ini → return 402.
 */
export class InsufficientCreditsError extends Error {
  constructor(public required: number, public balance: number) {
    super(`Credit tidak cukup. Butuh ~${required}, saldo ${balance}.`);
    this.name = "InsufficientCreditsError";
  }
}

/**
 * Helper: wrap any async handler to catch InsufficientCreditsError → 402.
 * Usage:
 *   return handleAiRequest(req, res, async () => { ... });
 */
export async function handleAiRequest<T>(
  req: Request,
  res: (body: T | Response) => Response,
  handler: () => Promise<T>
): Promise<Response> {
  try {
    const result = await handler();
    return res(result);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return new Response(
        JSON.stringify({
          error: err.message,
          required: err.required,
          balance: err.balance,
          code: "INSUFFICIENT_CREDITS",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }
    throw err; // re-throw untuk default error handler Next.js
  }
}

// ============================================================================
// STREAMING HELPER
// ============================================================================

export interface StreamCallbacks {
  onToken: (delta: string) => void;
}

/**
 * Pemanggilan AI streaming dengan metering. Mengembalikan teks utuh di akhir
 * sekaligus info biaya (callback onDone).
 *
 * Metering token streaming: pakai estimasi (streaming sering tidak kembalikan
 * usage). Bila provider kembalikan usage di chunk terakhir, dipakai itu.
 */
export async function streamComplete(
  opts: CompleteOptions,
  callbacks: {
    onToken: (delta: string) => void;
    onDone?: (result: { text: string; creditCost: number; tokensIn: number; tokensOut: number }) => void;
    onError?: (err: Error) => void;
  },
  userId?: string
): Promise<void> {
  const resolved = await resolveClient(userId);
  const model = opts.model || resolved.model;

  const turns: Turn[] = [];
  if (opts.system) turns.push({ role: "system", content: opts.system });
  if (opts.messages?.length) {
    for (const m of opts.messages) {
      if (m.role === "system") continue;
      turns.push(m);
    }
  } else if (opts.user) {
    turns.push({ role: "user", content: opts.user });
  }

  // Pre-check saldo platform.
  if (resolved.source === "platform" && userId) {
    const estOut = opts.maxTokens || 1024;
    const estIn = turns.reduce((n, t) => n + estimateTokens(t.content), 0);
    const est = computeCost(opts.feature, estIn, estOut, true);
    const affordable = await canAfford(userId, est.creditCost);
    if (!affordable) {
      callbacks.onError?.(new InsufficientCreditsError(est.creditCost, await getBalance(userId)));
      return;
    }
  }

  const body: Record<string, unknown> = {
    model,
    messages: turns,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1024,
    stream: true,
    stream_options: { include_usage: true }, // minta usage di chunk terakhir bila didukung
  };
  if (opts.json) body.response_format = { type: "json_object" };

  let fullText = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let estimated = false;

  try {
    const stream = await resolved.client.chat.completions.create(body as any);
    for await (const chunk of stream as any) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      if (delta) {
        fullText += delta;
        callbacks.onToken(delta);
      }
      // Beberapa provider kembalikan usage di chunk terakhir.
      const usage = chunk.usage;
      if (usage && typeof usage.prompt_tokens === "number") {
        tokensIn = usage.prompt_tokens;
        tokensOut = usage.completion_tokens || 0;
      }
    }

    if (tokensIn === 0 && tokensOut === 0) {
      tokensIn = estimateTokens(turns.map((t) => t.content).join("\n"));
      tokensOut = estimateTokens(fullText);
      estimated = true;
    }

    const cost = computeCost(opts.feature, tokensIn, tokensOut, estimated);
    let creditCost = 0;

    if (resolved.source === "platform" && userId) {
      const d = await deductCredits(userId, cost.creditCost, {
        feature: opts.feature,
        tokensIn,
        tokensOut,
        model,
        source: "platform",
        estimated,
        taskId: opts.taskId,
      });
      creditCost = d.charged;
    } else if (userId) {
      try {
        await UsageLog.create({
          userId,
          feature: opts.feature,
          source: "byok",
          model,
          tokensIn,
          tokensOut,
          estimated,
          creditCost: 0,
          status: "ok",
        });
      } catch {}
    }

    callbacks.onDone?.({ text: fullText, creditCost, tokensIn, tokensOut });
  } catch (err) {
    const e = err instanceof Error ? err : new Error("Stream gagal");
    callbacks.onError?.(e);
    // Log kegagalan.
    if (userId) {
      try {
        await UsageLog.create({
          userId,
          feature: opts.feature,
          source: resolved.source,
          model,
          tokensIn: 0,
          tokensOut: 0,
          creditCost: 0,
          status: "error",
          error: e.message.slice(0, 300),
        });
      } catch {}
    }
  }
}

/**
 * Test koneksi BYOK. Panggilan minimal (1 token) untuk verifikasi kunci valid.
 * Tidak memotong credit (feature="byok_test", bobot 0).
 */
export async function testByokConnection(
  baseURL: string,
  apiKey: string,
  model: string
): Promise<{ ok: boolean; model?: string; error?: string }> {
  try {
    const client = new OpenAI({ apiKey, baseURL });
    const resp = await client.chat.completions.create({
      model: model || "gpt-4o-mini",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    });
    return { ok: true, model: resp.model };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg.slice(0, 200) };
  }
}
