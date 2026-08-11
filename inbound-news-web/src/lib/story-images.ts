/** Shared helpers for story / article image URLs. */

import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

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
  // Cloud metadata / link-local hostnames that resolve privately in practice.
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

/** Sync string-level host check (no DNS). Prefer `assertPublicUrl` before fetch. */
export function isSafeHost(url: string): boolean {
  if (!isHttpUrl(url)) return false
  try {
    return !isPrivateHost(new URL(url).hostname)
  } catch {
    return false
  }
}

/**
 * Resolve hostname and reject if any A/AAAA record is private.
 * Fail-closed on DNS errors so a transient lookup failure cannot open SSRF.
 */
export async function resolvesToPublicHost(hostname: string): Promise<boolean> {
  if (!hostname || isPrivateHost(hostname)) return false
  // Literal IPs: already checked above.
  if (isIP(hostname)) return !isPrivateHost(hostname)
  try {
    const results = await lookup(hostname, { all: true, verbatim: true })
    if (!results.length) return false
    return results.every((r) => !isPrivateHost(r.address))
  } catch {
    return false
  }
}

/** Full SSRF gate: scheme + string host + DNS resolution. */
export async function assertPublicUrl(url: string): Promise<boolean> {
  if (!isSafeHost(url)) return false
  try {
    const hostname = new URL(url).hostname
    return await resolvesToPublicHost(hostname)
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
