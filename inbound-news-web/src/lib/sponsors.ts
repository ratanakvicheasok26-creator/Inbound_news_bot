/** Sponsor creatives for AdBand — mocks locally; Supabase when configured. */

export type AdPlacement = "home" | "homeFeed" | "story" | "brief" | "donate"

export const ALL_PLACEMENTS: AdPlacement[] = ["home", "homeFeed", "story", "brief", "donate"]

export type SponsorCreative = {
  id: string
  brand: string
  line: string
  cta: string
  href: string
  imageUrl: string
  active: boolean
  weight?: number
  placements?: AdPlacement[]
}

/** Believable brand mocks with poster images (layout review / local fallback). */
export const MOCK_SPONSORS: SponsorCreative[] = [
  {
    id: "aba-bank",
    brand: "ABA Bank",
    line: "Pay merchants and freelancers in seconds — banking built for Phnom Penh’s digital economy.",
    cta: "Open account",
    href: "#",
    imageUrl:
      "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&h=500&fit=crop&q=80",
    active: true,
    weight: 1,
    placements: [...ALL_PLACEMENTS],
  },
  {
    id: "smart-axiata",
    brand: "Smart Axiata",
    line: "Faster 5G for creators and remote teams — stay online when the story breaks.",
    cta: "View plans",
    href: "#",
    imageUrl:
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=500&fit=crop&q=80",
    active: true,
    weight: 1,
    placements: [...ALL_PLACEMENTS],
  },
  {
    id: "wing-money",
    brand: "Wing Bank",
    line: "Send, spend, and save from one app — money that moves at internet speed.",
    cta: "Get Wing",
    href: "#",
    imageUrl:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=500&fit=crop&q=80",
    active: true,
    weight: 1,
    placements: [...ALL_PLACEMENTS],
  },
  {
    id: "notion",
    brand: "Notion",
    line: "One workspace for briefs, sources, and research notes — ship coverage faster.",
    cta: "Try free",
    href: "#",
    imageUrl:
      "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=500&fit=crop&q=80",
    active: true,
    weight: 1,
    placements: [...ALL_PLACEMENTS],
  },
  {
    id: "cloudflare",
    brand: "Cloudflare",
    line: "Secure and speed up your site worldwide — protection that stays out of the way.",
    cta: "Start free",
    href: "#",
    imageUrl:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=500&fit=crop&q=80",
    active: true,
    weight: 1,
    placements: [...ALL_PLACEMENTS],
  },
  {
    id: "trueid",
    brand: "TrueID",
    line: "Verify customers once — trusted digital identity for apps across ASEAN.",
    cta: "Learn more",
    href: "#",
    imageUrl:
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=500&fit=crop&q=80",
    active: true,
    weight: 1,
    placements: [...ALL_PLACEMENTS],
  },
]

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function todayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function poolForPlacement(
  sponsors: SponsorCreative[],
  placement: AdPlacement
): SponsorCreative[] {
  const active = sponsors.filter((s) => s.active)
  const base = active.length > 0 ? active : sponsors
  const matching = base.filter((s) => {
    const slots = s.placements
    if (!slots || slots.length === 0) return true
    return slots.includes(placement)
  })
  const pool = matching.length > 0 ? matching : base
  const expanded: SponsorCreative[] = []
  for (const s of pool) {
    const w = Math.max(1, Math.min(10, s.weight ?? 1))
    for (let i = 0; i < w; i++) expanded.push(s)
  }
  return expanded
}

/** Unique active creatives for a slot (order preserved) — used by 30s client rotation. */
export function uniqueSponsorsForPlacement(
  placement: AdPlacement,
  sponsors: SponsorCreative[]
): SponsorCreative[] {
  const seen = new Set<string>()
  const unique: SponsorCreative[] = []
  for (const s of poolForPlacement(sponsors, placement)) {
    if (seen.has(s.id)) continue
    seen.add(s.id)
    unique.push(s)
  }
  return unique
}

/** Stable pick per calendar day + placement (supports weight + placement filters). */
export function pickSponsorFrom(
  placement: AdPlacement,
  sponsors: SponsorCreative[],
  dayYmd = todayYmdUtc()
): SponsorCreative | null {
  const pool = poolForPlacement(sponsors, placement)
  if (pool.length === 0) return null
  const idx = hashSeed(`${dayYmd}:${placement}`) % pool.length
  return pool[idx]!
}

/** Local mock pick — used when Supabase has no active sponsors. */
export function pickSponsor(
  placement: AdPlacement,
  dayYmd = todayYmdUtc()
): SponsorCreative {
  return pickSponsorFrom(placement, MOCK_SPONSORS, dayYmd) ?? MOCK_SPONSORS[0]!
}
