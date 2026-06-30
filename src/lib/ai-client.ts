import OpenAI from "openai";
import { connectDB } from "./db/mongodb";
import { ApiKey } from "./db/models/ApiKey";
import { User } from "./db/models/User";
import { UsageLog } from "./db/models/UsageLog";
import { decryptSecret } from "./crypto";
import { estimateTokens, type FeatureName } from "./credit-config";
import {
  tryProviderChain,
  getFallbackChain,
  resolveProvider,
  type ResolvedProvider,
  PROVIDERS,
} from "./ai-providers";
import { getToolDefinitions, executeTool } from "./agents/tools/registry";

/**
 * AI Client v3 — NVIDIA NIM ONLY. AI gratis untuk semua user.
 *
 * Flow:
 *   1. Cek BYOK (user pakai API key sendiri).
 *   2. Semua call lewat NVIDIA NIM (DeepSeek V4 Pro).
 *   3. Tidak ada credit check / deduction — AI gratis.
 *   4. Metering pakai real token count (UsageLog).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Turn {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface CompleteOptions {
  /** Identifikasi fitur untuk metering. */
  feature: FeatureName;
  system?: string;
  messages?: Turn[];
  user?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  model?: string;
  taskId?: string;
  forceProvider?: string;
}

export interface CompleteResult {
  text: string;
  model: string;
  source: "platform" | "byok";
  provider: string;
  /** Selalu 0 — AI gratis. */
  creditCost: number;
  tokensIn: number;
  tokensOut: number;
  estimated: boolean;
}

// ─── BYOK Resolver ──────────────────────────────────────────────────────────

export interface ResolvedClient {
  client: OpenAI;
  baseURL: string;
  model: string;
  source: "platform" | "byok";
  apiKeyId?: string;
}

async function resolveByok(userId: string): Promise<ResolvedClient | null> {
  try {
    await connectDB();
    const user = await User.findById(userId).lean();
    if (!user?.byokEnabled) return null;
    const key = await ApiKey.findOne({ userId, active: true }).lean();
    if (!key?.encryptedKey) return null;
    const apiKey = decryptSecret(key.encryptedKey);
    return {
      client: new OpenAI({ apiKey, baseURL: key.baseURL }),
      baseURL: key.baseURL,
      model: key.model || "gpt-4o-mini",
      source: "byok",
      apiKeyId: String(key._id),
    };
  } catch (err) {
    console.warn("[ai-client] BYOK resolve failed:", err);
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildBody(opts: CompleteOptions, model: string, stream = false): Record<string, unknown> {
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

  const body: Record<string, unknown> = {
    model,
    messages: turns,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1024,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  if (stream) {
    body.stream = true;
    body.stream_options = { include_usage: true };
  }
  return body;
}

function buildTurns(opts: CompleteOptions): Turn[] {
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
  return turns;
}

async function executeSingle(
  provider: ResolvedProvider,
  body: Record<string, unknown>
): Promise<{
  text: string;
  tokensIn: number;
  tokensOut: number;
  estimated: boolean;
}> {
  const resp = await provider.client.chat.completions.create(body as any);
  const text = (resp.choices?.[0]?.message?.content || "").trim();
  const usage = (resp as any).usage;
  let tokensIn = 0;
  let tokensOut = 0;
  let estimated = false;

  if (usage && typeof usage.prompt_tokens === "number") {
    tokensIn = usage.prompt_tokens;
    tokensOut = usage.completion_tokens || estimateTokens(text);
  } else {
    const turns = (body.messages as Turn[]) || [];
    tokensIn = estimateTokens(turns.map((t) => t.content).join("\n"));
    tokensOut = estimateTokens(text);
    estimated = true;
  }

  return { text, tokensIn, tokensOut, estimated };
}

// ─── Non-Streaming Complete ─────────────────────────────────────────────────

export async function complete(
  opts: CompleteOptions,
  userId?: string
): Promise<CompleteResult> {
  // BYOK check first.
  if (userId) {
    const byok = await resolveByok(userId);
    if (byok) {
      const body = buildBody(opts, opts.model || byok.model);
      const { text, tokensIn, tokensOut, estimated } = await executeSingle(
        { client: byok.client, config: { name: "BYOK" } as any, model: byok.model, source: "byok" },
        body
      );
      try {
        await UsageLog.create({
          userId,
          feature: opts.feature,
          taskId: opts.taskId || "",
          source: "byok",
          model: byok.model,
          tokensIn,
          tokensOut,
          estimated,
          creditCost: 0,
          status: "ok",
        });
      } catch {}
      return {
        text,
        model: byok.model,
        source: "byok",
        provider: "BYOK",
        creditCost: 0,
        tokensIn,
        tokensOut,
        estimated,
      };
    }
  }

  // Platform call via NVIDIA NIM.
  const chain = opts.forceProvider
    ? [opts.forceProvider]
    : getFallbackChain(opts.feature);

  const chainResult = await tryProviderChain(
    chain,
    async (resolved) => {
      const model = opts.model || resolved.model;
      const body = buildBody({ ...opts, model }, model);
      return executeSingle(resolved, body);
    }
  );

  const { text, tokensIn, tokensOut, estimated } = chainResult.result;

  // Log usage (no billing).
  if (userId) {
    try {
      await UsageLog.create({
        userId,
        feature: opts.feature,
        taskId: opts.taskId || "",
        source: "platform",
        model: chainResult.model,
        tokensIn,
        tokensOut,
        estimated,
        creditCost: 0,
        status: "ok",
        provider: chainResult.provider,
      });
    } catch {}
  }

  return {
    text,
    model: chainResult.model,
    source: "platform",
    provider: chainResult.provider,
    creditCost: 0,
    tokensIn,
    tokensOut,
    estimated,
  };
}

// ─── Streaming ──────────────────────────────────────────────────────────────

export async function streamComplete(
  opts: CompleteOptions,
  callbacks: {
    onToken: (delta: string) => void;
    onDone?: (result: {
      text: string;
      creditCost: number;
      tokensIn: number;
      tokensOut: number;
      provider: string;
    }) => void;
    onError?: (err: Error) => void;
  },
  userId?: string
): Promise<void> {
  // BYOK check.
  if (userId) {
    const byok = await resolveByok(userId);
    if (byok) {
      const body = buildBody(opts, opts.model || byok.model, true);
      try {
        await streamFromProvider(
          { client: byok.client, config: { name: "BYOK" } as any, model: byok.model, source: "byok" },
          body,
          callbacks,
          userId,
          opts,
          true
        );
      } catch (err) {
        callbacks.onError?.(err instanceof Error ? err : new Error("BYOK stream failed"));
      }
      return;
    }
  }

  // NVIDIA NIM streaming.
  const chain = opts.forceProvider
    ? [opts.forceProvider]
    : getFallbackChain(opts.feature);

  const errors: string[] = [];

  for (const providerKey of chain) {
    const config = PROVIDERS[providerKey];
    if (!config) continue;

    const apiKey = process.env[config.apiKeyEnv];
    if (!apiKey) {
      errors.push(`${config.name}: not configured`);
      continue;
    }

    const client = new OpenAI({ apiKey, baseURL: config.baseURL });
    const model = opts.model || config.defaultModel;
    const body = buildBody({ ...opts, model }, model, true);

    try {
      await streamFromProvider(
        { client, config, model, source: "platform" },
        body,
        callbacks,
        userId,
        opts,
        false,
        config.name
      );
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${config.name}: ${msg.slice(0, 100)}`);
      console.warn(`[ai-client] stream: ${config.name} failed`);
    }
  }

  callbacks.onError?.(
    new Error(`All streaming providers failed: ${errors.join("; ")}`)
  );
}

async function streamFromProvider(
  provider: ResolvedProvider,
  body: Record<string, unknown>,
  callbacks: {
    onToken: (delta: string) => void;
    onDone?: (result: any) => void;
    onError?: (err: Error) => void;
  },
  userId: string | undefined,
  opts: CompleteOptions,
  isByok: boolean,
  providerName?: string
): Promise<void> {
  let fullText = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let estimated = false;

  try {
    const stream = await provider.client.chat.completions.create(body as any);
    for await (const chunk of stream as any) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      if (delta) {
        fullText += delta;
        callbacks.onToken(delta);
      }
      const usage = chunk.usage;
      if (usage && typeof usage.prompt_tokens === "number") {
        tokensIn = usage.prompt_tokens;
        tokensOut = usage.completion_tokens || 0;
      }
    }

    if (tokensIn === 0 && tokensOut === 0) {
      const turns = (body.messages as Turn[]) || [];
      tokensIn = estimateTokens(turns.map((t) => t.content).join("\n"));
      tokensOut = estimateTokens(fullText);
      estimated = true;
    }

    if (isByok) {
      try {
        await UsageLog.create({
          userId,
          feature: opts.feature,
          source: "byok",
          model: provider.model,
          tokensIn,
          tokensOut,
          estimated,
          creditCost: 0,
          status: "ok",
        });
      } catch {}
      callbacks.onDone?.({
        text: fullText,
        creditCost: 0,
        tokensIn,
        tokensOut,
        provider: "BYOK",
      });
      return;
    }

    try {
      await UsageLog.create({
        userId,
        feature: opts.feature,
        source: "platform",
        model: provider.model,
        tokensIn,
        tokensOut,
        estimated,
        creditCost: 0,
        status: "ok",
        provider: providerName,
      });
    } catch {}

    callbacks.onDone?.({
      text: fullText,
      creditCost: 0,
      tokensIn,
      tokensOut,
      provider: providerName || provider.config.name,
    });
  } catch (err) {
    throw err instanceof Error ? err : new Error("Stream failed");
  }
}

// ─── Tool-Calling Complete (Function Calling) ────────────────────────────────

export interface ToolCallResult {
  text: string;
  model: string;
  source: "platform" | "byok";
  provider: string;
  creditCost: number;
  tokensIn: number;
  tokensOut: number;
  estimated: boolean;
  toolsUsed: string[];
  sources: Array<{ type: string; title: string; content: string; url?: string; doi?: string }>;
}

const MAX_TOOL_ROUNDS = 5;

/**
 * Complete with tool-calling support. The AI can call tools (search material,
 * web search, journals, etc.) during the conversation. Max 5 rounds of tool
 * calls to prevent infinite loops.
 */
export async function completeWithTools(
  opts: CompleteOptions,
  userId?: string,
  useTools: boolean = true
): Promise<ToolCallResult> {
  if (!useTools || !userId) {
    const result = await complete(opts, userId);
    return { ...result, toolsUsed: [], sources: [] };
  }

  const toolsUsed: string[] = [];
  const allSources: Array<{ type: string; title: string; content: string; url?: string; doi?: string }> = [];

  // Build messages array
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

  const toolDefs = getToolDefinitions();

  // Resolve client (BYOK or platform)
  let client: OpenAI;
  let model: string;
  let source: "platform" | "byok" = "platform";
  let provider = "";

  if (userId) {
    const byok = await resolveByok(userId);
    if (byok) {
      client = byok.client;
      model = opts.model || byok.model;
      source = "byok";
      provider = "BYOK";
    } else {
      const chain = getFallbackChain(opts.feature);
      const resolved = resolveProvider(chain[0]);
      if (!resolved) throw new Error("No AI provider configured");
      client = resolved.client;
      model = opts.model || resolved.model;
      provider = resolved.config.name;
    }
  } else {
    const chain = getFallbackChain(opts.feature);
    const resolved = resolveProvider(chain[0]);
    if (!resolved) throw new Error("No AI provider configured");
    client = resolved.client;
    model = opts.model || resolved.model;
    provider = resolved.config.name;
  }

  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let estimated = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const body: Record<string, unknown> = {
      model,
      messages: turns,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 1024,
      tools: toolDefs,
      tool_choice: "auto",
    };

    const resp = await client.chat.completions.create(body as any);
    const choice = resp.choices?.[0];
    if (!choice) break;

    const usage = (resp as any).usage;
    if (usage && typeof usage.prompt_tokens === "number") {
      totalTokensIn = usage.prompt_tokens;
      totalTokensOut = usage.completion_tokens || 0;
    }

    // If no tool calls, we have the final answer
    if (!choice.message?.tool_calls || choice.message.tool_calls.length === 0) {
      const text = (choice.message?.content || "").trim();

      if (totalTokensIn === 0 && totalTokensOut === 0) {
        totalTokensIn = estimateTokens(turns.map((t) => t.content).join("\n"));
        totalTokensOut = estimateTokens(text);
        estimated = true;
      }

      // Log usage
      if (userId) {
        try {
          await UsageLog.create({
            userId,
            feature: opts.feature,
            taskId: opts.taskId || "",
            source,
            model,
            tokensIn: totalTokensIn,
            tokensOut: totalTokensOut,
            estimated,
            creditCost: 0,
            status: "ok",
            provider,
          });
        } catch {}
      }

      return {
        text,
        model,
        source,
        provider,
        creditCost: 0,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        estimated,
        toolsUsed,
        sources: allSources,
      };
    }

    // Process tool calls
    turns.push(choice.message as Turn);

    for (const toolCall of choice.message.tool_calls) {
      const toolName = (toolCall as any).function?.name || "";
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse((toolCall as any).function?.arguments || "{}");
      } catch {}

      const result = await executeTool(toolName, args, userId);
      toolsUsed.push(toolName);

      // Collect sources from tool results
      if (result.sources) {
        allSources.push(...result.sources);
      }

      turns.push({
        role: "tool" as const,
        content: result.data,
      });
    }
  }

  // Fallback: if we exhausted rounds, make one final call without tools
  const finalBody: Record<string, unknown> = {
    model,
    messages: turns,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1024,
  };

  const finalResp = await client.chat.completions.create(finalBody as any);
  const finalText = (finalResp.choices?.[0]?.message?.content || "").trim();
  const finalUsage = (finalResp as any).usage;
  if (finalUsage && typeof finalUsage.prompt_tokens === "number") {
    totalTokensIn = finalUsage.prompt_tokens;
    totalTokensOut = finalUsage.completion_tokens || 0;
  }

  if (userId) {
    try {
      await UsageLog.create({
        userId,
        feature: opts.feature,
        taskId: opts.taskId || "",
        source,
        model,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        estimated,
        creditCost: 0,
        status: "ok",
        provider,
      });
    } catch {}
  }

  return {
    text: finalText,
    model,
    source,
    provider,
    creditCost: 0,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    estimated,
    toolsUsed,
    sources: allSources,
  };
}

// ─── Legacy Errors (backward compat) ────────────────────────────────────────

export class InsufficientCreditsError extends Error {
  constructor(public required: number, public balance: number) {
    super(`Credit tidak cukup. Butuh ~${required}, saldo ${balance}.`);
    this.name = "InsufficientCreditsError";
  }
}

export async function handleAiRequest<T>(
  _req: Request,
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
    throw err;
  }
}

// ─── Legacy: resolveClient ──────────────────────────────────────────────────

export async function resolveClient(
  userId?: string,
  _legacyProvider?: string
): Promise<ResolvedClient> {
  if (userId) {
    const byok = await resolveByok(userId);
    if (byok) return byok;
  }

  const config = PROVIDERS.nvidia;
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY belum dikonfigurasi. Daftar di build.nvidia.com");
  }
  return {
    client: new OpenAI({ apiKey, baseURL: config.baseURL }),
    baseURL: config.baseURL,
    model: config.defaultModel,
    source: "platform",
  };
}

// ─── BYOK Test ──────────────────────────────────────────────────────────────

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
