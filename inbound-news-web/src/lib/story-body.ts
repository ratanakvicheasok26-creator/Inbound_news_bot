import type { Article, StoryWithArticles } from "@/lib/types"

export function isUsefulSummary(text: string): boolean {
  const t = text.trim()
  if (t.length < 48) return false
  const lower = t.toLowerCase()
  if (lower.startsWith("tags:")) return false
  if (lower.startsWith("posted by")) return false
  if (/^tags?:\s*.+\.\s*posted by\.?$/i.test(t)) return false
  // Short HN-style meta without the title
  if (/^\d+\s+points?\s+by\b/i.test(t) && t.length < 80) return false
  return true
}

function parseRawJson(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
  }
  return null
}

/** Rebuild a readable summary from Lobste.rs / HN raw payload when stored summary is junk. */
export function summaryFromArticleRaw(article: Article): string | null {
  const raw = parseRawJson(article.raw_json)
  if (!raw) return null

  const title = (article.title || (raw.title as string) || "").trim()
  if (!title) return null

  // Lobste.rs
  if (
    article.source_name === "Lobste.rs" ||
    typeof raw.submitter_user !== "undefined" ||
    typeof raw.description_plain !== "undefined"
  ) {
    const desc = String(raw.description_plain || raw.description || "").trim()
    if (desc && isUsefulSummary(desc)) return desc.slice(0, 500)

    const tags = Array.isArray(raw.tags) ? (raw.tags as string[]) : []
    const tagStr = tags.length ? tags.join(", ") : "tech"
    let username = ""
    const submitter = raw.submitter_user
    if (typeof submitter === "string") username = submitter.trim()
    else if (submitter && typeof submitter === "object") {
      username = String((submitter as { username?: string }).username || "").trim()
    }
    const score = typeof raw.score === "number" ? raw.score : null
    const comments =
      typeof raw.comment_count === "number" ? raw.comment_count : null

    const bits = [`${title} — discussed on Lobste.rs (${tagStr})`]
    if (username) bits.push(`submitted by ${username}`)
    if (score != null) bits.push(`${score} points`)
    if (comments != null) bits.push(`${comments} comments`)
    return bits.join(" · ") + "."
  }

  // Hacker News Algolia
  if (typeof raw.points !== "undefined" || typeof raw.story_text !== "undefined") {
    const storyText = String(raw.story_text || "").trim()
    if (storyText && isUsefulSummary(storyText)) return storyText.slice(0, 500)
    const points = Number(raw.points || 0)
    const comments = Number(raw.num_comments || 0)
    const author = String(raw.author || "").trim()
    return (
      `${title}. ${points} points on Hacker News` +
      (author ? ` by ${author}` : "") +
      ` · ${comments} comments.`
    )
  }

  return null
}

export function synthesizeStoryBody(input: {
  title: string
  primary_source?: string | null
  source_count?: number | null
  articles?: {
    source_name?: string | null
    source_domain?: string | null
    summary?: string | null
  }[]
}): string {
  const source =
    input.primary_source ||
    input.articles?.[0]?.source_name ||
    input.articles?.[0]?.source_domain ||
    "Inbound Reports"
  const count = input.source_count || input.articles?.length || 1
  return (
    `${input.title}. This story was clustered from ${count} source` +
    `${count === 1 ? "" : "s"} via ${source}. ` +
    `Open the source link below for the full article.`
  )
}

/** Pick the best available body copy for the story page. */
export function resolveStoryBody(story: StoryWithArticles): string {
  const candidates: string[] = []
  if (story.summary_en) candidates.push(story.summary_en)
  for (const article of story.articles || []) {
    if (article.summary) candidates.push(article.summary)
  }
  // Prefer longer useful summaries first (ingest rewrite quality varies).
  const useful = candidates
    .map((s) => s.trim())
    .filter(isUsefulSummary)
    .sort((a, b) => b.length - a.length)
  if (useful[0]) return useful[0]

  for (const article of story.articles || []) {
    const rebuilt = summaryFromArticleRaw(article)
    if (rebuilt && isUsefulSummary(rebuilt)) return rebuilt
  }

  return synthesizeStoryBody(story)
}

const ELI5_WORD_MAP: Record<string, string> = {
  utilize: "use",
  implement: "build",
  facilitate: "help",
  leverage: "use",
  infrastructure: "systems",
  paradigm: "approach",
  methodology: "method",
  comprehensive: "full",
  significant: "big",
  substantial: "large",
  innovative: "new",
  ecosystem: "network",
  vulnerability: "security hole",
  ransomware: "ransom malware",
  acquisition: "buyout",
  regulators: "rule-makers",
  antitrust: "anti-monopoly",
}

function simplifyForEli5(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  const kept = sentences.slice(0, Math.min(3, Math.max(2, Math.ceil(sentences.length / 2))))
  return kept
    .map((s) =>
      s
        .replace(
          /\b(?:utilize|implement|facilitate|leverage|infrastructure|paradigm|methodology|comprehensive|significant|substantial|innovative|ecosystem|vulnerability|ransomware|acquisition|regulators|antitrust)\b/gi,
          (m) => ELI5_WORD_MAP[m.toLowerCase()] || m
        )
        .replace(/\s*\([^)]{0,80}\)\s*/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .filter(Boolean)
    .join(" ")
}

function deepenWithSources(standard: string, articles: Article[]): string {
  const extras = articles
    .map((a) => (a.summary || "").trim())
    .filter((s) => isUsefulSummary(s))
    .filter((s) => s !== standard && !standard.includes(s.slice(0, 80)))
    .slice(0, 2)
  if (extras.length === 0) return standard
  return [standard, ...extras].join(" ")
}

export type ReadingTier = "eli5" | "standard" | "deep"

/** Build tier texts from one solid body. Same layout — only copy differs when useful. */
export function buildTierTexts(
  standardBody: string,
  articles: Article[] = []
): Record<ReadingTier, string> {
  const standard = standardBody.trim()
  const eli5 = simplifyForEli5(standard) || standard
  const deep = deepenWithSources(standard, articles)
  return { eli5, standard, deep }
}

/** True when at least one non-standard tier is meaningfully different. */
export function tiersHaveDistinctContent(tiers: Record<ReadingTier, string>): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase()
  const standard = norm(tiers.standard)
  if (!standard) return false
  return norm(tiers.eli5) !== standard || norm(tiers.deep) !== standard
}

/** Short dek for cards — omit junk placeholders entirely. */
export function resolveStoryDek(
  summary: string | null | undefined,
  maxLen = 180
): string | null {
  if (!summary || !isUsefulSummary(summary)) return null
  const t = summary.trim()
  if (t.length <= maxLen) return t
  return t.slice(0, maxLen - 1).trimEnd() + "…"
}

/**
 * Strip the full body from a premium story before it reaches the client.
 * Only a short teaser is exposed; the rest is fetched via `/api/story/[id]/full`
 * by members (JWT-checked server-side).
 */
export function redactPremiumStory(
  story: StoryWithArticles
): { content: StoryWithArticles; teaser: string | null } {
  const teaser = resolveStoryDek(resolveStoryBody(story), 170)
  return {
    content: {
      ...story,
      summary_en: null,
      articles: (story.articles || []).map((a) => ({ ...a, summary: null, raw_json: null })),
    },
    teaser,
  }
}
