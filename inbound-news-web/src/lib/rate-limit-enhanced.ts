type Bucket = { count: number; resetAt: number; backoffUntil?: number }

const loginStore = new Map<string, Bucket>()
const ipStore = new Map<string, Bucket>()
const MAX_LOGIN_KEYS = 50_000
const MAX_IP_KEYS = 50_000

const MAX_FAILED_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000]

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
  attemptsRemaining: number
}

export function checkLoginRateLimit(identifier: string, clientIp: string): RateLimitResult {
  const now = Date.now()
  const accountResult = checkBucket(loginStore, `login:${identifier}`, MAX_FAILED_ATTEMPTS, WINDOW_MS, MAX_LOGIN_KEYS, now)
  const ipResult = checkBucket(ipStore, `ip:${clientIp}`, 20, WINDOW_MS, MAX_IP_KEYS, now)

  const denied = !accountResult.allowed || !ipResult.allowed
  const retryAfterMs = Math.max(accountResult.retryAfterMs, ipResult.retryAfterMs)

  return {
    allowed: !denied,
    retryAfterMs,
    attemptsRemaining: Math.max(0, accountResult.attemptsRemaining),
  }
}

export function recordFailedLogin(identifier: string, clientIp: string): number {
  const now = Date.now()
  incrementBucket(loginStore, `login:${identifier}`, WINDOW_MS, MAX_LOGIN_KEYS, now)
  incrementBucket(ipStore, `ip:${clientIp}`, WINDOW_MS, MAX_IP_KEYS, now)

  const bucket = loginStore.get(`login:${identifier}`)
  if (!bucket) return 0
  return Math.min(bucket.count - 1, BACKOFF_DELAYS.length - 1)
}

export function getBackoffDelay(attemptIndex: number): number {
  const idx = Math.min(attemptIndex, BACKOFF_DELAYS.length - 1)
  return BACKOFF_DELAYS[idx]
}

export function clearLoginAttempts(identifier: string): void {
  loginStore.delete(`login:${identifier}`)
}

function checkBucket(
  store: Map<string, Bucket>,
  key: string,
  limit: number,
  windowMs: number,
  maxKeys: number,
  now: number,
): { allowed: boolean; retryAfterMs: number; attemptsRemaining: number } {
  const bucket = store.get(key)

  if (!bucket || now >= bucket.resetAt) {
    if (store.size >= maxKeys) pruneExpired(store, now)
    return { allowed: true, retryAfterMs: 0, attemptsRemaining: limit }
  }

  if (bucket.backoffUntil && now < bucket.backoffUntil) {
    return {
      allowed: false,
      retryAfterMs: bucket.backoffUntil - now,
      attemptsRemaining: 0,
    }
  }

  if (bucket.count >= limit) {
    const retryAfter = bucket.resetAt - now
    return { allowed: false, retryAfterMs: retryAfter, attemptsRemaining: 0 }
  }

  return {
    allowed: true,
    retryAfterMs: 0,
    attemptsRemaining: limit - bucket.count,
  }
}

function incrementBucket(
  store: Map<string, Bucket>,
  key: string,
  windowMs: number,
  maxKeys: number,
  now: number,
): void {
  let bucket = store.get(key)

  if (!bucket || now >= bucket.resetAt) {
    if (store.size >= maxKeys) pruneExpired(store, now)
    bucket = { count: 1, resetAt: now + windowMs }
    store.set(key, bucket)
    return
  }

  bucket.count++
  const attemptIdx = Math.min(bucket.count - 2, BACKOFF_DELAYS.length - 1)
  if (attemptIdx >= 0 && bucket.count <= BACKOFF_DELAYS.length + 1) {
    bucket.backoffUntil = now + getBackoffDelay(attemptIdx)
  }
}

function pruneExpired(store: Map<string, Bucket>, now: number): void {
  for (const [key, bucket] of store) {
    if (now >= bucket.resetAt) store.delete(key)
  }
}
