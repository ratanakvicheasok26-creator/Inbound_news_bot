import { isValidImageUrl, isSafeHost } from "@/lib/story-images"

const OG_RE =
  /<meta\s+[^>]*(?:property|name)=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i
const OG_RE_ALT =
  /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image(?::secure_url)?["']/i
const TW_RE =
  /<meta\s+[^>]*(?:property|name)=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i
const TW_RE_ALT =
  /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']twitter:image(?::src)?["']/i

function absolutize(base: string, candidate: string): string {
  try {
    return new URL(candidate, base).toString()
  } catch {
    return candidate
  }
}

const MAX_REDIRECTS = 4

/**
 * Fetch a page while re-validating the host on every redirect hop.
 *
 * `fetch` with default redirect handling would follow a 30x to an internal
 * host (e.g. cloud metadata at 169.254.169.254) even though the original URL
 * passed `isSafeHost`. Following manually and re-checking each Location closes
 * that SSRF vector.
 */
async function safeFetchHtml(pageUrl: string): Promise<Response | null> {
  let url = pageUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeHost(url)) return null
    const res = await fetch(url, {
      headers: {
        "User-Agent": "InboundReports/1.0 (+https://inboundreports.com; image discovery)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(4500),
      next: { revalidate: 86400 },
    })
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location")
      if (!location) return null
      url = new URL(location, url).toString()
      continue
    }
    return res
  }
  return null
}

/**
 * Fetch Open Graph / Twitter image for a page URL.
 * Cached by Next fetch (revalidate 24h).
 */
export async function resolveOgImage(pageUrl: string): Promise<string | null> {
  if (!isValidImageUrl(pageUrl) || !isSafeHost(pageUrl)) return null

  try {
    const res = await safeFetchHtml(pageUrl)
    if (!res || !res.ok) return null
    const html = (await res.text()).slice(0, 160_000)
    for (const re of [OG_RE, OG_RE_ALT, TW_RE, TW_RE_ALT]) {
      const m = html.match(re)
      if (m?.[1]) {
        const candidate = absolutize(pageUrl, m[1].trim())
        if (isValidImageUrl(candidate)) return candidate
      }
    }
  } catch {
    return null
  }
  return null
}
