/**
 * Client helpers for search / outbound links.
 * Keep HTTP(S)-only and cancel in-flight work so typing cannot pile up requests.
 */

/** Allow only http(s) URLs for rendered hrefs (blocks javascript:/data:). */
export function safeExternalHref(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null
  const t = url.trim()
  try {
    const u = new URL(t)
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    return t
  } catch {
    return null
  }
}

export type JsonFetchResult<T> =
  | { ok: true; data: T; aborted: false }
  | { ok: false; data: T | null; aborted: boolean; status?: number }

/**
 * fetch + json with AbortSignal. Treats abort as a soft failure (aborted=true)
 * so callers can ignore stale responses without throwing.
 */
export async function fetchJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<JsonFetchResult<T>> {
  try {
    const res = await fetch(url, { signal, cache: "no-store" })
    if (!res.ok) {
      // Still try to parse body for structured error payloads.
      let data: T | null = null
      try {
        data = (await res.json()) as T
      } catch {
        /* ignore */
      }
      return { ok: false, data, aborted: false, status: res.status }
    }
    const data = (await res.json()) as T
    return { ok: true, data, aborted: false }
  } catch (err) {
    const aborted =
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError") ||
      Boolean(signal?.aborted)
    return { ok: false, data: null, aborted }
  }
}

/** In-memory cache for /api/resolve-image so a homepage of N cards does not N-hit. */
const resolveImageCache = new Map<string, string | null>()
const resolveImageInflight = new Map<string, Promise<string | null>>()

export async function resolveImageCached(
  pageUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (resolveImageCache.has(pageUrl)) {
    return resolveImageCache.get(pageUrl) ?? null
  }
  const existing = resolveImageInflight.get(pageUrl)
  if (existing) return existing

  const pending = (async () => {
    const result = await fetchJson<{ imageUrl?: string | null }>(
      `/api/resolve-image?url=${encodeURIComponent(pageUrl)}`,
      signal,
    )
    if (result.aborted) return null
    const imageUrl =
      result.ok && typeof result.data?.imageUrl === "string"
        ? result.data.imageUrl
        : null
    // Cache misses too, to avoid retry storms for pages with no OG image.
    if (!result.aborted) resolveImageCache.set(pageUrl, imageUrl)
    return imageUrl
  })()

  resolveImageInflight.set(pageUrl, pending)
  try {
    return await pending
  } finally {
    resolveImageInflight.delete(pageUrl)
  }
}
