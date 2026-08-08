import { CATEGORIES } from "@/lib/categories"
import type { Story } from "@/lib/types"

/** Canonical tech topic slugs used across the product. */
export const TECH_CATEGORY_SLUGS: Set<string> = new Set(
  CATEGORIES.map((c) => c.slug)
)

/**
 * Hard rejects — general news / non-tech that sometimes lands in ingest
 * (earthquakes, pure politics, demographics, sports).
 */
const NON_TECH_TITLE_RE =
  /\b(?:earthquake|aftershock|magnitude\s*m?\d|hurricane|typhoon|tornado|wildfire|flood warning|body\s*cam|outnumber children|box\s*office|nba|nfl|mlb|premier league|election results?|stock market closes|lottery)\b/i

/** Positive tech signals when category is missing or weak. */
const TECH_SIGNAL_RE =
  /\b(?:ai|a\.i\.|llm|gpt|openai|anthropic|machine learning|cyber|hack(?:er|ing)?|ransomware|malware|startup|saas|fintech|crypto|bitcoin|ethereum|blockchain|defi|chip|semiconductor|gpu|nvidia|apple|google|microsoft|meta|amazon|aws|azure|cloud|devops|kubernetes|software|app\b|ios|android|iphone|api\b|open[\s-]?source|github|programming|developer|tech(?:nology|nical)?|internet|broadband|5g|telecom|robot(?:ics)?|quantum|vr\b|ar\b|metaverse|data\s*center|privacy|surveillance|regulation|antitrust|sec\b|fda\b.*(?:ai|software|device))\b/i

export function isTechCategory(category: string | null | undefined): boolean {
  const slug = (category || "").trim().toLowerCase()
  return Boolean(slug) && TECH_CATEGORY_SLUGS.has(slug)
}

/**
 * True when a story belongs on a tech-news product surface.
 * Keeps known tech categories; drops hard non-tech titles; requires a tech
 * signal when category is missing/unknown.
 */
export function isTechRelevant(story: {
  title?: string | null
  summary_en?: string | null
  category?: string | null
  tags?: string[] | null
}): boolean {
  const title = (story.title || "").trim()
  const summary = (story.summary_en || "").trim()
  const haystack = `${title} ${summary} ${(story.tags || []).join(" ")}`

  if (!title) return false
  if (NON_TECH_TITLE_RE.test(title)) return false

  if (isTechCategory(story.category)) {
    // Category ok — still require at least a weak tech cue for pure "science"
    // outliers that aren't tech (optional: allow science without cue)
    if (story.category === "science" && !TECH_SIGNAL_RE.test(haystack)) {
      // Allow space/astronomy/lab science only if not clearly non-tech already rejected
      // Prefer tech-flavored science; drop pure natural-history without tech words
      if (
        /\b(?:black hole|galaxy|dinosaur|fossil|archeolog|archaeolog|ancient library|life on earth arose)\b/i.test(
          title
        )
      ) {
        return false
      }
    }
    return true
  }

  // Unknown / empty category — only keep clear tech signal
  return TECH_SIGNAL_RE.test(haystack)
}

/** Filter to tech-relevant stories; preserves input order. */
export function filterTechStories<T extends {
  title?: string | null
  summary_en?: string | null
  category?: string | null
  tags?: string[] | null
}>(stories: T[]): T[] {
  return stories.filter(isTechRelevant)
}
