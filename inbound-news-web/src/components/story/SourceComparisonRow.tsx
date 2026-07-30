import type { Article } from "@/lib/types"
import { formatDistanceToNow } from "@/lib/utils"
import { TrustRadar } from "./TrustRadar"
import { ExternalLink } from "lucide-react"
import Link from "next/link"

interface SourceTrust {
  primary_sourcing: number
  technical_accuracy: number
  originality: number
  corrections: number
  funding_disclosure: number
}

interface SourceComparisonRowProps {
  article: Article
  trustScore?: number
  trustAxes?: SourceTrust
  hypeScore?: number
  framing?: string
}

/** Domains that have dedicated /source/[slug] pages. */
const SOURCE_DOMAIN_SLUGS: Record<string, string> = {
  "reuters.com": "reuters",
  "techcrunch.com": "techcrunch",
  "theverge.com": "the-verge",
  "arstechnica.com": "arstechnica",
}

function sourcePageSlug(domain: string): string | null {
  const normalized = domain.toLowerCase().replace(/^www\./, "")
  if (SOURCE_DOMAIN_SLUGS[normalized]) return SOURCE_DOMAIN_SLUGS[normalized]
  for (const [d, slug] of Object.entries(SOURCE_DOMAIN_SLUGS)) {
    if (normalized === d || normalized.endsWith(`.${d}`)) return slug
  }
  return null
}

function deriveTrustAxes(article: Article, baseScore: number): SourceTrust {
  const domain = article.source_domain || ""
  if (domain.includes("arxiv") || domain.includes("ieee") || domain.includes("acm")) {
    return { primary_sourcing: 5, technical_accuracy: 5, originality: 4, corrections: 5, funding_disclosure: 3 }
  }
  if (domain.includes("techcrunch") || domain.includes("theverge") || domain.includes("wired")) {
    return { primary_sourcing: 3, technical_accuracy: 4, originality: 3, corrections: 4, funding_disclosure: 4 }
  }
  if (domain.includes("medium") || domain.includes("substack")) {
    return { primary_sourcing: 2, technical_accuracy: 3, originality: 4, corrections: 2, funding_disclosure: 2 }
  }
  return {
    primary_sourcing: Math.max(1, baseScore - 1),
    technical_accuracy: baseScore,
    originality: Math.max(1, baseScore - 1),
    corrections: Math.min(5, baseScore + 1),
    funding_disclosure: Math.max(1, baseScore - 1),
  }
}

function deriveHypeScore(article: Article): number {
  const title = (article.title || "").toLowerCase()
  let score = 40
  const hypeWords = ["revolutionary", "game-changing", "unprecedented", "breakthrough", "disrupt", "killer", "massive", "stunning", "shocking", "insane", "unbelievable"]
  for (const word of hypeWords) {
    if (title.includes(word)) score += 12
  }
  if (title.includes("!")) score += 5
  if (title.match(/\b(all|every|never|always|nobody|everyone)\b/)) score += 8
  return Math.min(95, score)
}

export function SourceComparisonRow({ article, trustScore = 3, trustAxes, framing }: SourceComparisonRowProps) {
  const axes = trustAxes || deriveTrustAxes(article, trustScore)
  const hypeScore = deriveHypeScore(article)
  const domain = article.source_domain || ""
  const sourceSlug = domain ? sourcePageSlug(domain) : null

  return (
    <div className="source-row">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 bg-[var(--text-primary)] shrink-0" />
            <span className="font-mono text-[12px] font-bold text-[var(--text-primary)]">
              {article.source_name || domain || "Unknown"}
            </span>
            {domain && (
              sourceSlug ? (
                <Link
                  href={`/source/${sourceSlug}`}
                  className="font-mono text-[10px] text-[var(--accent)] bg-[var(--surface-alt)] px-1.5 py-0.5 font-medium border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
                >
                  {domain}
                </Link>
              ) : (
                <span className="font-mono text-[10px] text-[var(--text-secondary)] bg-[var(--surface-alt)] px-1.5 py-0.5 font-medium border border-[var(--border)]">
                  {domain}
                </span>
              )
            )}
          </div>

          <p className="text-[14px] font-bold text-[var(--text-primary)] leading-snug mb-1">
            {article.title}
          </p>

          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-medium">
            {article.published_at && <span>{formatDistanceToNow(article.published_at)}</span>}
          </div>

          {(article.summary || framing) && (
            <div className="framing-box mt-2">
              {framing || article.summary}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 font-bold">
                Coverage intensity
              </p>
              <div className="relative h-[8px] bg-gradient-to-r from-[var(--text-primary)] via-[var(--text-secondary)] to-[var(--red-alert)]">
                <div
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[8px] h-[8px] rounded-full border border-[var(--text-primary)] bg-[var(--surface)] ${hypeScore > 75 ? "!border-[var(--red-alert)]" : ""}`}
                  style={{ left: `${hypeScore}%` }}
                  title={`Coverage: ${hypeScore}/100`}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="font-mono text-[10px] text-[var(--text-secondary)]">Quiet</span>
                <span className="font-mono text-[10px] text-[var(--text-secondary)]">Wide</span>
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 font-bold">
                Source Trust
              </p>
              <TrustRadar score={Math.round((axes.primary_sourcing + axes.technical_accuracy + axes.originality + axes.corrections + axes.funding_disclosure) / 5)} axes={Object.entries(axes).map(([key, val]) => ({ label: key, score: val }))} size="sm" />
            </div>
          </div>
        </div>

        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  )
}
