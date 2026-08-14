/** Tech outlet roles — Ground News–style axes for tech, not politics. */

export type OutletRole =
  | "booster"
  | "trade"
  | "critical"
  | "community"
  | "research"
  | "corporate"

export type CoverageOutlet = {
  name: string
  domain: string
  role: OutletRole
}

export const OUTLET_ROLE_LABELS: Record<OutletRole, string> = {
  booster: "Booster",
  trade: "Trade",
  critical: "Critical",
  community: "Community",
  research: "Research",
  corporate: "Corporate",
}

const ROLE_BY_DOMAIN: Record<string, OutletRole> = {
  // Booster / launch press
  "techcrunch.com": "booster",
  "theverge.com": "booster",
  "venturebeat.com": "booster",
  "mashable.com": "booster",
  "engadget.com": "booster",
  "cnet.com": "booster",
  "zdnet.com": "booster",
  "thenextweb.com": "booster",
  "protocol.com": "booster",
  "axios.com": "booster",

  // Trade / mainstream tech reporting
  "reuters.com": "trade",
  "bloomberg.com": "trade",
  "ft.com": "trade",
  "wsj.com": "trade",
  "nytimes.com": "trade",
  "washingtonpost.com": "trade",
  "bbc.com": "trade",
  "bbc.co.uk": "trade",
  "cnn.com": "trade",
  "theinformation.com": "trade",
  "wired.com": "trade",
  "technologyreview.com": "trade",
  "spectrum.ieee.org": "trade",
  "ieee.org": "trade",
  "computerworld.com": "trade",
  "infoworld.com": "trade",
  "theregister.com": "trade",
  "siliconangle.com": "trade",
  "sdxcentral.com": "trade",
  "techradar.com": "trade",
  "tomshardware.com": "trade",
  "pcmag.com": "trade",
  "nine.com.au": "trade",
  "scmp.com": "trade",
  "nikkei.com": "trade",
  "restofworld.org": "trade",
  "semafor.com": "trade",

  // Critical / skeptical
  "arstechnica.com": "critical",
  "theintercept.com": "critical",
  "404media.co": "critical",
  "pluralistic.net": "critical",
  "eff.org": "critical",
  "techdirt.com": "critical",
  "gizmodo.com": "critical",
  "vice.com": "critical",
  "motherboard.vice.com": "critical",
  "theguardian.com": "critical",
  "propublica.org": "critical",

  // Community
  "news.ycombinator.com": "community",
  "hnrss.org": "community",
  "lobste.rs": "community",
  "reddit.com": "community",
  "old.reddit.com": "community",
  "www.reddit.com": "community",
  "slashdot.org": "community",
  "stackoverflow.blog": "community",
  "dev.to": "community",
  "hashnode.com": "community",
  "medium.com": "community",

  // Research / security
  "arxiv.org": "research",
  "nature.com": "research",
  "science.org": "research",
  "acm.org": "research",
  "krebsonsecurity.com": "research",
  "bleepingcomputer.com": "research",
  "thehackernews.com": "research",
  "darkreading.com": "research",
  "schneier.com": "research",
  "securityweek.com": "research",
  "cisa.gov": "research",
  "nist.gov": "research",
  "mitre.org": "research",
  "snyk.io": "research",
  "googleprojectzero.blogspot.com": "research",

  // Corporate / vendor
  "blog.google": "corporate",
  "blog.youtube": "corporate",
  "openai.com": "corporate",
  "anthropic.com": "corporate",
  "meta.com": "corporate",
  "about.fb.com": "corporate",
  "microsoft.com": "corporate",
  "blogs.microsoft.com": "corporate",
  "aws.amazon.com": "corporate",
  "amazon.science": "corporate",
  "apple.com": "corporate",
  "developer.apple.com": "corporate",
  "nvidia.com": "corporate",
  "blogs.nvidia.com": "corporate",
  "cloudflare.com": "corporate",
  "blog.cloudflare.com": "corporate",
  "stripe.com": "corporate",
  "github.blog": "corporate",
  "engineering.fb.com": "corporate",
  "netflixtechblog.com": "corporate",
  "uber.com": "corporate",
  "eng.uber.com": "corporate",
}

const COMMUNITY_DOMAINS = new Set([
  "lobste.rs",
  "news.ycombinator.com",
  "hnrss.org",
  "reddit.com",
  "old.reddit.com",
  "www.reddit.com",
  "slashdot.org",
])

export function normalizeDomain(domain: string | null | undefined): string {
  return (domain || "").trim().toLowerCase().replace(/^www\./, "")
}

export function roleForDomain(domain: string | null | undefined): OutletRole {
  const d = normalizeDomain(domain)
  if (!d) return "trade"
  if (ROLE_BY_DOMAIN[d]) return ROLE_BY_DOMAIN[d]
  for (const [known, role] of Object.entries(ROLE_BY_DOMAIN)) {
    if (d === known || d.endsWith(`.${known}`)) return role
  }
  return "trade"
}

export function roleForOutlet(input: {
  source_name?: string | null
  source_domain?: string | null
}): OutletRole {
  const name = (input.source_name || "").trim().toLowerCase()
  if (
    name === "hacker news" ||
    name === "hn" ||
    name === "lobste.rs" ||
    name === "lobsters" ||
    name.includes("reddit")
  ) {
    return "community"
  }
  if (name.includes("cloudflare") || name.includes("google") || name.includes("openai")) {
    return "corporate"
  }
  return roleForDomain(input.source_domain)
}

export function isCommunityDomain(domain: string | null | undefined): boolean {
  const d = normalizeDomain(domain)
  if (!d) return false
  if (COMMUNITY_DOMAINS.has(d)) return true
  return [...COMMUNITY_DOMAINS].some((c) => d === c || d.endsWith(`.${c}`))
}

/** Coverage intensity proxy from outlet density (not AI hype). */
export function coverageScore(sourceCount: number): number {
  const n = Math.max(1, sourceCount || 1)
  return Math.min(100, 30 + n * 8)
}

export function outletFromArticle(input: {
  source_name?: string | null
  source_domain?: string | null
}): CoverageOutlet | null {
  const domain = normalizeDomain(input.source_domain)
  const name = (input.source_name || "").trim() || domain
  if (!name && !domain) return null
  return {
    name: name || domain || "Unknown",
    domain: domain || name.toLowerCase().replace(/\s+/g, ""),
    role: roleForOutlet(input),
  }
}

/** Unique outlets by domain, capped. */
export function uniqueOutlets(
  articles: { source_name?: string | null; source_domain?: string | null }[],
  limit = 5
): CoverageOutlet[] {
  const seen = new Set<string>()
  const out: CoverageOutlet[] = []
  for (const a of articles) {
    const outlet = outletFromArticle(a)
    if (!outlet) continue
    const key = outlet.domain || outlet.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(outlet)
    if (out.length >= limit) break
  }
  return out
}

export function summarizeCoverage(
  articles: { source_name?: string | null; source_domain?: string | null }[],
  fallbackSourceCount?: number
): {
  uniqueDomains: number
  roles: Partial<Record<OutletRole, number>>
  topOutlets: CoverageOutlet[]
  mapLine: string
} {
  const topOutlets = uniqueOutlets(articles, 8)
  const roles: Partial<Record<OutletRole, number>> = {}
  for (const o of topOutlets) {
    roles[o.role] = (roles[o.role] || 0) + 1
  }
  const uniqueDomains = Math.max(
    topOutlets.length,
    fallbackSourceCount && articles.length === 0 ? fallbackSourceCount : 0
  )
  const roleBits = (Object.entries(roles) as [OutletRole, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([role, n]) => `${OUTLET_ROLE_LABELS[role]} ${n}`)
  const mapLine =
    uniqueDomains > 0
      ? `${uniqueDomains} outlet${uniqueDomains !== 1 ? "s" : ""}${
          roleBits.length ? ` · ${roleBits.join(" · ")}` : ""
        }`
      : "No linked outlets yet"
  return { uniqueDomains, roles, topOutlets, mapLine }
}

/** Higher = stronger blindspot candidate (undercovered but worth noticing). */
export function blindspotScore(story: {
  summary_en?: string | null
  category?: string | null
  created_at?: string
  primary_source_domain?: string | null
  coverage_outlets?: CoverageOutlet[]
}): number {
  let score = 0
  const summary = (story.summary_en || "").trim()
  if (summary.length >= 80) score += 25
  else if (summary.length >= 40) score += 10

  const domain =
    story.primary_source_domain ||
    story.coverage_outlets?.[0]?.domain ||
    null
  if (isCommunityDomain(domain)) score -= 20
  else score += 10

  const cat = (story.category || "").toLowerCase()
  if (
    cat === "cybersecurity" ||
    cat === "regulation" ||
    cat === "ai" ||
    cat === "science"
  ) {
    score += 15
  }

  const t = Date.parse(story.created_at || "")
  if (!Number.isNaN(t)) {
    const ageH = (Date.now() - t) / 3_600_000
    if (ageH < 24) score += 20
    else if (ageH < 72) score += 10
    else if (ageH > 168) score -= 10
  }

  const role = story.coverage_outlets?.[0]?.role
  if (role === "research" || role === "critical") score += 12
  if (role === "booster" || role === "corporate") score -= 5

  return score
}

type BlindspotStory = {
  source_count?: number | null
  summary_en?: string | null
  category?: string | null
  created_at?: string
  primary_source?: string | null
  primary_source_domain?: string | null
  coverage_outlets?: CoverageOutlet[]
}

/** True singleton gap — Blindspot's primary admission rule. */
export function isUndercovered(story: BlindspotStory): boolean {
  return (story.source_count ?? 0) === 1
}

const HYPE_ROLES: OutletRole[] = ["booster", "corporate"]
const FORUM_ROLES: OutletRole[] = ["community"]

/**
 * Two outlets only, and both lean the same way (hype pair or forum pair).
 * Separate from true blindspots — "thin / skewed", not a Topics dump.
 */
export function isThinSkewed(story: BlindspotStory): boolean {
  if ((story.source_count ?? 0) !== 2) return false
  const outlets = story.coverage_outlets || []
  if (outlets.length < 2) {
    // Without outlet roles we cannot prove skew — exclude from thin section.
    return false
  }
  const roles = outlets.slice(0, 2).map((o) => o.role)
  const allHype = roles.every((r) => HYPE_ROLES.includes(r))
  const allForum = roles.every((r) => FORUM_ROLES.includes(r))
  return allHype || allForum
}

function formatAgeShort(createdAt?: string): string | null {
  const t = Date.parse(createdAt || "")
  if (Number.isNaN(t)) return null
  const ageH = (Date.now() - t) / 3_600_000
  if (ageH < 1) return "just now"
  if (ageH < 24) return `${Math.max(1, Math.round(ageH))}h ago`
  const days = Math.round(ageH / 24)
  return `${days}d ago`
}

/**
 * Short professional "why this is a gap" line for cards.
 * Example: "1 outlet · Research · 12h ago"
 */
export function blindspotWhy(story: BlindspotStory): string {
  const count = Math.max(1, story.source_count ?? 1)
  const parts: string[] = [
    `${count} outlet${count !== 1 ? "s" : ""}`,
  ]
  const role = story.coverage_outlets?.[0]?.role
  if (role) parts.push(OUTLET_ROLE_LABELS[role])
  const age = formatAgeShort(story.created_at)
  if (age) parts.push(age)
  const name =
    story.coverage_outlets?.[0]?.name ||
    story.primary_source ||
    null
  if (name && parts.length < 4) parts.push(name)
  return parts.join(" · ")
}

export function primaryOutletRole(story: BlindspotStory): OutletRole | null {
  return story.coverage_outlets?.[0]?.role ?? null
}

