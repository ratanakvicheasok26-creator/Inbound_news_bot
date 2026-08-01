/**
 * News Comparison analysis.
 *
 * Shared types for the AI (/api/compare) and the deterministic fallback that
 * runs when AI is unavailable. The fallback is intentionally conservative: it
 * only makes claims it can derive from the two articles' own summaries, and it
 * never invents facts.
 */

export interface CompareArticleInput {
  id: string
  title: string
  sourceName?: string | null
  sourceDomain?: string | null
  publishedAt?: string | null
  summary?: string | null
}

export interface ComparisonResult {
  shared: string[]
  differencesA: string[]
  differencesB: string[]
  perspectives: string[]
  factsA: string[]
  factsB: string[]
  agreement: string[]
  disagreement: string[]
  summary: string
  aiGenerated: boolean
}

export const NOT_COVERED = "Not covered in the available content."

export const EMPTY_COMPARISON: ComparisonResult = {
  shared: [],
  differencesA: [],
  differencesB: [],
  perspectives: [],
  factsA: [],
  factsB: [],
  agreement: [],
  disagreement: [],
  summary: "",
  aiGenerated: false,
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function sourceLabel(a: CompareArticleInput): string {
  return a.sourceName || a.sourceDomain || "Article A"
}

function sourceLabelB(b: CompareArticleInput): string {
  return b.sourceName || b.sourceDomain || "Article B"
}

/**
 * Deterministic, content-only comparison built from sentence overlap between
 * the two articles' summaries. No AI, no invented facts.
 */
export function deterministicComparison(
  a: CompareArticleInput,
  b: CompareArticleInput,
): ComparisonResult {
  const aText = (a.summary || "").trim()
  const bText = (b.summary || "").trim()
  const aSents = splitSentences(aText)
  const bSents = splitSentences(bText)

  const bNormalized = new Set(bSents.map(normalize).filter(Boolean))

  const shared: string[] = []
  const seenShared = new Set<string>()
  for (const s of aSents) {
    const n = normalize(s)
    if (n && bNormalized.has(n) && !seenShared.has(n)) {
      seenShared.add(n)
      shared.push(s)
      if (shared.length >= 6) break
    }
  }

  const sharedNorm = new Set(shared.map(normalize))
  const differencesA = aSents.filter((s) => !sharedNorm.has(normalize(s))).slice(0, 5)
  const differencesB = bSents.filter((s) => !sharedNorm.has(normalize(s))).slice(0, 5)

  const nameA = sourceLabel(a)
  const nameB = sourceLabelB(b)

  const perspectives: string[] = []
  if (aSents[0]) perspectives.push(`${nameA} leads with: “${aSents[0]}”`)
  else perspectives.push(`${nameA}’s available summary does not state a specific angle.`)
  if (bSents[0]) perspectives.push(`${nameB} leads with: “${bSents[0]}”`)
  else perspectives.push(`${nameB}’s available summary does not state a specific angle.`)
  if (differencesA[0]) perspectives.push(`${nameA} additionally reports: “${differencesA[0]}”`)
  if (differencesB[0]) perspectives.push(`${nameB} additionally reports: “${differencesB[0]}”`)

  const factsA = aSents.slice(0, 5).map((s) => `Per ${nameA}: ${s}`)
  const factsB = bSents.slice(0, 5).map((s) => `Per ${nameB}: ${s}`)

  const agreement = shared.slice()
  const disagreement = [
    "No explicit disagreement found in the available summaries. Any conflict would need to be checked against the full articles.",
  ]

  const parts: string[] = []
  if (shared.length) {
    parts.push(`Both articles report the same core facts: ${shared.slice(0, 2).join(" ")}`)
  }
  if (differencesA[0]) parts.push(`${nameA} adds: ${differencesA[0].replace(/\.$/, "")}.`)
  if (differencesB[0]) parts.push(`${nameB} adds: ${differencesB[0].replace(/\.$/, "")}.`)

  const summary = parts.length
    ? parts.join(" ")
    : `Both articles cover ${a.title || "this story"}. The available summaries do not share word-for-word statements.`

  return {
    shared,
    differencesA,
    differencesB,
    perspectives,
    factsA,
    factsB,
    agreement,
    disagreement,
    summary,
    aiGenerated: false,
  }
}
