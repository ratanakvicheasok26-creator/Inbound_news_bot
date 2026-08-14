/** Shared helpers for story / article image URLs. Safe for Client Components. */

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

/** True when the host is an IP literal in a private/loopback/link-local range. */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase()
  const ipv4 = host.match(
    /^(?:10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|0\.)/
  )
  if (ipv4) return true
  if (host === "localhost" || host.endsWith(".localhost")) return true
  if (
    host === "metadata.google.internal" ||
    host === "metadata" ||
    host.endsWith(".internal")
  ) {
    return true
  }
  if (host.includes(":")) {
    if (
      host === "::1" ||
      host.startsWith("fe80:") ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("::ffff:")
    ) {
      return true
    }
    const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped?.[1] && isPrivateHost(mapped[1])) return true
  }
  return false
}

/** Sync string-level host check (no DNS). Prefer `assertPublicUrl` (server) before fetch. */
export function isSafeHost(url: string): boolean {
  if (!isHttpUrl(url)) return false
  try {
    return !isPrivateHost(new URL(url).hostname)
  } catch {
    return false
  }
}

export function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== "string") return false
  const t = url.trim()
  if (!isHttpUrl(t) || t.length > 2000) return false
  return true
}

/** Fix mangled source URLs that contain HTML-escaped characters (e.g. &#x2f; for /). */
export function sanitizeImageUrl(url: string): string {
  return url
    .replace(/&#x2f;/gi, "/")
    .replace(/&#47;/gi, "/")
    .replace(/&#x5c;/gi, "\\")
    .replace(/&amp;/gi, "&")
    .replace(/&#x38;/gi, "&")
    .replace(/&#x3d;/gi, "=")
    .replace(/&#x3f;/gi, "?")
}

export function extractImageFromRaw(raw: unknown): string | null {
  let data = raw
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null
  const obj = data as Record<string, unknown>

  for (const key of [
    "socialimage",
    "image_url",
    "imageUrl",
    "urlToImage",
    "thumbnail",
    "image",
    "cover",
  ]) {
    const val = obj[key]
    if (typeof val === "string" && isValidImageUrl(val)) return val.trim()
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const nested = (val as Record<string, unknown>).url || (val as Record<string, unknown>).src
      if (typeof nested === "string" && isValidImageUrl(nested)) return nested.trim()
    }
  }
  return null
}

export function pickArticleImage(article: {
  image_url?: string | null
  raw_json?: unknown
}): string | null {
  if (isValidImageUrl(article.image_url)) return article.image_url.trim()
  return extractImageFromRaw(article.raw_json)
}

/** Hosts that already allow hotlinking — skip weserv (faster, no fail-then-swap flicker). */
const DIRECT_IMAGE_HOSTS = new Set([
  "images.unsplash.com",
  "unsplash.com",
  "plus.unsplash.com",
  "images.weserv.nl",
])

export function shouldLoadImageDirect(imageUrl: string): boolean {
  try {
    const host = new URL(sanitizeImageUrl(imageUrl)).hostname.toLowerCase()
    if (DIRECT_IMAGE_HOSTS.has(host)) return true
    if (host.endsWith(".supabase.co") && host.includes("storage")) return true
    if (host.endsWith(".supabase.in")) return true
  } catch {
    return false
  }
  return false
}

/**
 * Proxy via images.weserv.nl so Next/Image only needs one remote host
 * and hotlink blockers are less likely to break thumbnails.
 */
export function proxiedImageUrl(imageUrl: string, width = 960, height?: number): string {
  const stripped = sanitizeImageUrl(imageUrl.replace(/^https?:\/\//i, ""))
  const h = height ? `&h=${height}` : ""
  return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&w=${width}${h}&fit=cover&we&output=webp`
}

/** Display URL: direct for trusted CDNs, weserv otherwise. */
export function displayImageUrl(imageUrl: string, width = 960, height?: number): string {
  const clean = sanitizeImageUrl(imageUrl)
  if (shouldLoadImageDirect(clean)) return clean
  return proxiedImageUrl(clean, width, height)
}
