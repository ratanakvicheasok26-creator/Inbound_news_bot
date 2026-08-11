import type { NextRequest } from "next/server"

/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Protects paid upstream calls (Groq, Exa) and expensive DB endpoints from
 * anonymous floods. It is per-process, so on multi-instance/serverless hosting
 * it caps abuse per instance rather than globally — enough to blunt a
 * single-source flood without adding Redis.
 */

type Bucket = { count: number; resetAt: number }

const store = new Map<string, Bucket>()
const MAX_KEYS = 10_000

/**
 * Best-effort client IP.
 *
 * Prefer platform-provided headers (Vercel/CF/Railway). Do not trust a
 * client-supplied `x-forwarded-for` alone — when no platform header is
 * present, fall back to a shared "unknown" bucket so spoofed XFF cannot
 * mint unlimited per-IP quotas.
 */
export function getClientIp(req: NextRequest): string {
  const vercel = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
  if (vercel) return vercel
  const realIp = req.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  const cf = req.headers.get("cf-connecting-ip")?.trim()
  if (cf) return cf
  // Untrusted / missing platform identity — shared bucket (stricter effective cap).
  return "unknown"
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
    // Still over cap: drop oldest entries instead of wiping everyone.
    if (store.size >= MAX_KEYS) evictOldest(Math.ceil(MAX_KEYS * 0.1))
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
}

function evictOldest(n: number): void {
  let removed = 0
  for (const key of store.keys()) {
    store.delete(key)
    removed++
    if (removed >= n) break
  }
}
