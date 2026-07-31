/** Shared helpers for story / article image URLs. */

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === "http:" || u.protocol === "https:"
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
export function proxiedImageUrl(imageUrl: string, width = 960): string {
  const stripped = imageUrl.replace(/^https?:\/\//i, "")
  return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&w=${width}&fit=cover&we&output=webp`
}
