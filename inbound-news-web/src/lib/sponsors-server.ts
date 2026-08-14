import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import {
  ALL_PLACEMENTS,
  MOCK_SPONSORS,
  type AdPlacement,
  type SponsorCreative,
} from "@/lib/sponsors"

type SponsorRow = {
  id: string
  brand: string
  line: string
  cta: string
  href: string
  image_url: string
  active: boolean
  weight: number | null
  placements: string[] | null
}

function mapRow(row: SponsorRow): SponsorCreative {
  const placements = (row.placements || [])
    .filter((p): p is AdPlacement => (ALL_PLACEMENTS as string[]).includes(p))
  return {
    id: row.id,
    brand: row.brand,
    line: row.line,
    cta: row.cta || "Learn more",
    href: row.href,
    imageUrl: row.image_url,
    active: row.active,
    weight: row.weight ?? 1,
    placements: placements.length > 0 ? placements : [...ALL_PLACEMENTS],
  }
}

/**
 * Active sponsors from Supabase. Falls back to mocks when unset/empty/error
 * so local review keeps working.
 */
export async function getActiveSponsors(): Promise<{
  sponsors: SponsorCreative[]
  source: "supabase" | "mock"
}> {
  if (!isSupabaseConfigured) {
    return { sponsors: MOCK_SPONSORS, source: "mock" }
  }

  try {
    const { data, error } = await supabase
      .from("sponsors")
      .select("id, brand, line, cta, href, image_url, active, weight, placements")
      .eq("active", true)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("sponsors fetch failed:", error.message)
      return { sponsors: MOCK_SPONSORS, source: "mock" }
    }

    const rows = (data || []) as SponsorRow[]
    if (rows.length === 0) {
      return { sponsors: MOCK_SPONSORS, source: "mock" }
    }

    return { sponsors: rows.map(mapRow), source: "supabase" }
  } catch (err) {
    console.error("sponsors fetch raised:", err)
    return { sponsors: MOCK_SPONSORS, source: "mock" }
  }
}
