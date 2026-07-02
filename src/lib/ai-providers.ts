/**
 * AI Providers — Multi-provider fallback chain.
 *
 * Chain: NVIDIA NIM → Groq → Moonshot → OpenAI.
 * Jika provider utama gagal, otomatis fallback ke provider berikutnya.
 *
 * Credit system DISABLED — AI gratis untuk semua user.
 * Metering pakai real token count.
 */

import OpenAI from "openai";

export interface ProviderConfig {
  name: string;
  baseURL: string;
  apiKeyEnv: string;
  defaultModel: string;
  models?: Record<string, string>;
  rateLimitPerMin?: number;
}

/** Circuit breaker state. */
interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
  openUntil: number;
}

const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 60_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

// ─── Provider Config ────────────────────────────────────────────────────────

export const PROVIDERS: Record<string, ProviderConfig> = {
  nvidia: {
    name: "NVIDIA NIM",
    baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
    apiKeyEnv: "NVIDIA_API_KEY",
    defaultModel: "deepseek-ai/deepseek-v4-pro",
    models: {
      deepseek: "deepseek-ai/deepseek-v4-pro",
      deepseek_flash: "deepseek-ai/deepseek-v4-flash",
      llama4: "meta/llama-4-scout-17b-16e-instruct",
      gpt_oss: "openai/gpt-oss-120b",
    },
    rateLimitPerMin: 60,
  },
  groq: {
    name: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    models: {
      scout: "meta-llama/llama-4-scout-17b-16e-instruct",
      maverick: "meta-llama/llama-4-maverick-17b-128e-instruct",
    },
    rateLimitPerMin: 30,
  },
  moonshot: {
    name: "Moonshot (Kimi)",
    baseURL: "https://api.moonshot.cn/v1",
    apiKeyEnv: "MOONSHOT_API_KEY",
    defaultModel: "kimi-k2.6",
    rateLimitPerMin: 30,
  },
  openai: {
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-5-mini",
    rateLimitPerMin: 50,
  },
};

// ─── Circuit Breaker ────────────────────────────────────────────────────────

const circuitStates = new Map<string, CircuitState>();
const rateLimitWindows = new Map<string, number[]>();

function getCircuitState(providerName: string): CircuitState {
  if (!circuitStates.has(providerName)) {
    circuitStates.set(providerName, { failures: 0, lastFailure: 0, open: false, openUntil: 0 });
  }
  return circuitStates.get(providerName)!;
}

function recordSuccess(providerName: string) {
  const state = getCircuitState(providerName);
  state.failures = 0;
  state.open = false;
}

function recordFailure(providerName: string) {
  const state = getCircuitState(providerName);
  state.failures += 1;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_THRESHOLD) {
    state.open = true;
    state.openUntil = Date.now() + CIRCUIT_RESET_MS;
    console.warn(`[circuit-breaker] ${providerName} OPENED for ${CIRCUIT_RESET_MS / 1000}s`);
  }
}

function isCircuitOpen(providerName: string): boolean {
  const state = getCircuitState(providerName);
  if (!state.open) return false;
  if (Date.now() >= state.openUntil) {
    state.open = false;
    state.failures = 0;
    console.log(`[circuit-breaker] ${providerName} CLOSED (timeout)`);
    return false;
  }
  return true;
}

function checkRateLimit(providerName: string, limitPerMin: number): boolean {
  const now = Date.now();
  const window = rateLimitWindows.get(providerName) || [];
  const recent = window.filter((t) => now - t < 60_000);
  if (recent.length >= limitPerMin) return false;
  recent.push(now);
  rateLimitWindows.set(providerName, recent);
  return true;
}

// ─── Client Resolver ────────────────────────────────────────────────────────

export interface ResolvedProvider {
  client: OpenAI;
  config: ProviderConfig;
  model: string;
  source: "platform" | "byok";
}

export function resolveProvider(
  providerKey: string,
  modelOverride?: string
): ResolvedProvider | null {
  const config = PROVIDERS[providerKey];
  if (!config) return null;

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    console.warn(`[ai-providers] ${providerKey}: ${config.apiKeyEnv} not set`);
    return null;
  }

  const model = modelOverride || config.defaultModel;
  const client = new OpenAI({ apiKey, baseURL: config.baseURL });

  return {
    client,
    config,
    model,
    source: "platform",
  };
}

// ─── Retry ──────────────────────────────────────────────────────────────────

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  providerName: string,
  maxRetries = MAX_RETRIES
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      recordSuccess(providerName);
      return result;
    } catch (err) {
      lastError = err;
      const isRetryable = isRetryableError(err);
      if (!isRetryable || attempt >= maxRetries) {
        recordFailure(providerName);
        throw err;
      }
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[ai-providers] ${providerName} attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw lastError;
}

function isRetryableError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err.status || "").toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("504") ||
    msg.includes("overloaded")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Execute (single provider) ──────────────────────────────────────────────

export interface ChainResult<T> {
  result: T;
  provider: string;
  model: string;
  attempts: number;
}

export async function tryProviderChain<T>(
  chain: string[],
  fn: (provider: ResolvedProvider) => Promise<T>,
  options?: {
    skipCircuitBreaker?: boolean;
    skipRateLimit?: boolean;
  }
): Promise<ChainResult<T>> {
  const errors: string[] = [];
  for (const providerKey of chain) {
    const config = PROVIDERS[providerKey];
    if (!config) continue;

    const apiKey = process.env[config.apiKeyEnv];
    if (!apiKey) {
      errors.push(`${config.name}: not configured`);
      continue;
    }

    if (!options?.skipCircuitBreaker && isCircuitOpen(config.name)) {
      errors.push(`${config.name}: circuit open`);
      continue;
    }

    if (!options?.skipRateLimit && config.rateLimitPerMin && !checkRateLimit(config.name, config.rateLimitPerMin)) {
      errors.push(`${config.name}: rate limited`);
      continue;
    }

    const resolved = resolveProvider(providerKey);
    if (!resolved) {
      errors.push(`${config.name}: resolve failed`);
      continue;
    }

    try {
      const result = await callWithRetry(() => fn(resolved), config.name);
      return {
        result,
        provider: config.name,
        model: resolved.model,
        attempts: errors.length + 1,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${config.name}: ${msg.slice(0, 100)}`);
      console.warn(`[ai-providers] ${config.name} failed, trying next...`);
    }
  }
  throw new Error(`All providers failed: ${errors.join("; ")}`);
}

// ─── Health Check ───────────────────────────────────────────────────────────

export async function checkProviderHealth(providerKey: string): Promise<{
  ok: boolean;
  latency: number;
  error?: string;
}> {
  const start = Date.now();
  const resolved = resolveProvider(providerKey);
  if (!resolved) {
    return { ok: false, latency: 0, error: "Not configured" };
  }

  try {
    await resolved.client.chat.completions.create({
      model: resolved.model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    });
    return { ok: true, latency: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latency: Date.now() - start,
      error: err instanceof Error ? err.message.slice(0, 100) : "Unknown",
    };
  }
}

export async function checkAllProvidersHealth(): Promise<
  Record<string, { ok: boolean; latency: number; error?: string }>
> {
  const results: Record<string, { ok: boolean; latency: number; error?: string }> = {};
  for (const key of Object.keys(PROVIDERS)) {
    results[key] = await checkProviderHealth(key);
  }
  return results;
}

// ─── Fallback Chain ────────────────────────────────────────────────────────

export function getFallbackChain(feature?: string): string[] {
  // Priority order: NVIDIA (free, fast) → Groq (free, fast) → Moonshot → OpenAI
  return ["nvidia", "groq", "moonshot", "openai"].filter(
    (key) => PROVIDERS[key] && process.env[PROVIDERS[key].apiKeyEnv]
  );
}
