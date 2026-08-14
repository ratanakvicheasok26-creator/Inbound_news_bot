/**
 * Server-only SSRF helpers (DNS lookup). Do not import from Client Components.
 */

import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { isPrivateHost, isSafeHost } from "@/lib/story-images"

/**
 * Resolve hostname and reject if any A/AAAA record is private.
 * Fail-closed on DNS errors so a transient lookup failure cannot open SSRF.
 */
export async function resolvesToPublicHost(hostname: string): Promise<boolean> {
  if (!hostname || isPrivateHost(hostname)) return false
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
