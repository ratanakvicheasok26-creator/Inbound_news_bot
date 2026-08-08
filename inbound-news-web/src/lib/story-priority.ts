import { isValidImageUrl } from "./story-images"
import { resolveOgImage } from "./og-image"
import { isUsefulSummary } from "./story-body"
import { isTechRelevant } from "./tech-scope"
import type { Story } from "./types"

export type PriorityOptions = {
  /** Max stories to attempt server-side OG resolution for. */
  resolveLimit?: number
  /** Concurrent OG fetches. */
  concurrency?: number
  /** When true (default), apply feed ranking after image resolution. */
  rankForFeed?: boolean
}

/** Domains that often produce forum/meta noise rather than clustered news. */
const FORUM_DOMAINS = new Set([
  "lobste.rs",
  "news.ycombinator.com",
  "hnrss.org",
  "reddit.com",
  "old.reddit.com",
  "www.reddit.com",
])

const FORUM_TITLE_RE =
  /^(ask|show)\s+hn\b|^who\s+is\s+hiring\b|^tell\s+hn\b|^launch\s+hn\b/i

function normalizeDomain(domain: string | null | undefined): string {
  return (domain || "").trim().toLowerCase().replace(/^www\./, "")
}

function ageHours(createdAt: string): number {
  const t = Date.parse(createdAt)
  if (Number.isNaN(t)) return 72
  return Math.max(0, (Date.now() - t) / 3_600_000)
}

/**
 * Higher = better homepage / brief placement.
 * Prefers multi-source, imaged, recent, useful summaries; demotes forum-only noise
 * and non-tech outliers.
 */
export function feedScore(story: Story): number {
  const sources = Math.max(0, story.source_count || 0)
  const domain = normalizeDomain(story.primary_source_domain)
  const title = (story.title || "").trim()
  const summary = (story.summary_en || "").trim()

  let score = 0

  // Multi-source clusters are the product — strongest signal
  score += Math.min(sources, 8) * 28

  if (isValidImageUrl(story.image_url)) score += 40
  if (summary && isUsefulSummary(summary)) score += 22
  else if (summary.length >= 80) score += 8

  // Prefer last ~48h without burying strong older clusters
  const age = ageHours(story.created_at)
  score += Math.max(0, 48 - age) * 1.4

  if (sources === 0) score -= 120

  const forumDomain = FORUM_DOMAINS.has(domain)
  if (forumDomain && sources <= 1) score -= 90
  else if (forumDomain) score -= 25

  if (FORUM_TITLE_RE.test(title)) score -= 55

  // Very short titles often mean incomplete ingest
  if (title.length > 0 && title.length < 24) score -= 15

  // Tech-only product: bury non-tech so they never win the lead slot
  if (!isTechRelevant(story)) score -= 200

  return score
}

/** Stable sort by feedScore (desc). */
export function rankStoriesForFeed(stories: Story[]): Story[] {
  return stories
    .map((story, index) => ({ story, index, score: feedScore(story) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.index - b.index
    })
    .map(({ story }) => story)
}

/**
 * Pick top feed stories. Tech-relevant only; prefer items with at least one
 * source when enough exist.
 */
export function selectFeedStories(stories: Story[], limit: number): Story[] {
  if (stories.length === 0 || limit <= 0) return []
  const tech = stories.filter(isTechRelevant)
  const ranked = rankStoriesForFeed(tech.length > 0 ? tech : stories)
  const withSources = ranked.filter((s) => (s.source_count || 0) >= 1)
  const minNeeded = Math.min(3, limit)
  const pool = withSources.length >= minNeeded ? withSources : ranked
  return pool.slice(0, limit)
}

/**
 * Resolve missing story images server-side (results cached by Next fetch for
 * 24h via `resolveOgImage`), then rank for the reading feed.
 * Only import from server components / server modules.
 */
export async function prioritizeStoriesWithImages(
  stories: Story[],
  options: PriorityOptions = {},
): Promise<Story[]> {
  const { resolveLimit = 24, concurrency = 6, rankForFeed = true } = options
  if (stories.length === 0) return stories

  const missing = stories
    .filter((s) => !isValidImageUrl(s.image_url) && isValidImageUrl(s.primary_url))
    .slice(0, resolveLimit)

  let cursor = 0
  async function worker() {
    while (cursor < missing.length) {
      const story = missing[cursor++]
      const image = await resolveOgImage(story.primary_url as string)
      if (isValidImageUrl(image)) story.image_url = image
    }
  }

  const workers = Math.min(Math.max(concurrency, 1), Math.max(missing.length, 1))
  await Promise.all(Array.from({ length: workers }, worker))

  if (rankForFeed) {
    return rankStoriesForFeed(stories)
  }

  // Legacy: image-first stable sort only
  return stories
    .map((story, index) => ({ story, index }))
    .sort((a, b) => {
      const aHas = isValidImageUrl(a.story.image_url) ? 1 : 0
      const bHas = isValidImageUrl(b.story.image_url) ? 1 : 0
      if (aHas !== bHas) return bHas - aHas
      return a.index - b.index
    })
    .map(({ story }) => story)
}
