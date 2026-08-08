import type { NextRequest } from "next/server"

/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Protects paid upstream calls (Groq, Exa) from being looped by an anonymous
 * caller to drain the budget or exhaust rotated keys. It is per-process, so on
 * multi-instance/serverless hosting it caps abuse per instance rather than
 * globally — enough to blunt a single-source flood without adding Redis.
 */

type Bucket = { count: number; resetAt: number }

const store = new Map<string, Bucket>()
const MAX_KEYS = 10_000

/** Best-effort client IP from proxy headers; falls back to a shared bucket. */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown"
}

export type RateLimitResult = { ok: boolean; retryAfter: number }

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now >= bucket.resetAt) {
    if (store.size >= MAX_KEYS) pruneExpired(now)
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
  }

  bucket.count++
  return { ok: true, retryAfter: 0 }
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of store) {
    if (now >= bucket.resetAt) store.delete(key)
  }
  // If everything is still live, drop the whole map to bound memory.
  if (store.size >= MAX_KEYS) store.clear()
}
