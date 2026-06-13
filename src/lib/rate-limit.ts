/**
 * Simple in-memory sliding-window rate limiter.
 *
 * NOTE: state lives in a module-level Map, so it is per-instance / in-memory only.
 * In a multi-instance (serverless / horizontally-scaled) deployment each instance
 * keeps its own counters, so limits are not shared.
 * TODO: back this with Redis (or an upstash-style store) for accurate multi-instance limits.
 */

// key -> list of request timestamps (ms) within the current window
const hits = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Drop timestamps that have slid out of the window.
  const recent = (hits.get(key) ?? []).filter((ts) => ts > windowStart);

  if (recent.length >= limit) {
    // Oldest in-window hit determines when a slot frees up.
    const oldest = recent[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    hits.set(key, recent);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, remaining: Math.max(0, limit - recent.length), retryAfterMs: 0 };
}
