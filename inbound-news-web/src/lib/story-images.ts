/** Shared helpers for story / article image URLs. */

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

/** True when the host is an IP literal in a private/loopback/link-local range. */
function isPrivateHost(hostname: string): boolean {
  const ipv4 = hostname.match(
    /^(?:10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|0\.)/
  )
  if (ipv4) return true
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true
  if (hostname.includes(":")) {
    // IPv6: block loopback, link-local, ULA, and mapped-v4 private ranges.
    const lower = hostname.toLowerCase()
    if (
      lower.startsWith("::1") ||
      lower.startsWith("fe80:") ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("::ffff:")
    ) {
      return true
    }
    const tail = lower.split(":").pop()
    if (tail && isPrivateHost(tail)) return true
  }
  return false
}

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

/**
 * Proxy via images.weserv.nl so Next/Image only needs one remote host
 * and hotlink blockers are less likely to break thumbnails.
 */
export function proxiedImageUrl(imageUrl: string, width = 960, height?: number): string {
  const stripped = sanitizeImageUrl(imageUrl.replace(/^https?:\/\//i, ""))
  const h = height ? `&h=${height}` : ""
  return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&w=${width}${h}&fit=cover&we&output=webp`
}
