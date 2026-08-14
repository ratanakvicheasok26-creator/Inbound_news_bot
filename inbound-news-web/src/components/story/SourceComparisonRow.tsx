import type { Article } from "@/lib/types"
import { resolveStoryDek } from "@/lib/story-body"
import { formatDistanceToNow } from "@/lib/utils"
import { OUTLET_ROLE_LABELS, roleForOutlet } from "@/lib/outlet-roles"
import { ExternalLink, GitCompareArrows } from "lucide-react"
import Link from "next/link"
import { safeExternalHref } from "@/lib/client-fetch"

interface SourceComparisonRowProps {
  article: Article
  framing?: string
  /** Story body is member-gated; hide source-synopsis compare links. */
  locked?: boolean
}

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

export function SourceComparisonRow({ article, framing, locked = false }: SourceComparisonRowProps) {
  const domain = article.source_domain || ""
  const sourceSlug = domain ? sourcePageSlug(domain) : null
  const role = roleForOutlet({
    source_name: article.source_name,
    source_domain: domain,
  })
  const articleHref = safeExternalHref(article.url)

  return (
    <div className="source-row">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">
              {article.source_name || domain || "Unknown"}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--surface-alt)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
              {OUTLET_ROLE_LABELS[role]}
            </span>
            {domain && (
              sourceSlug ? (
                <Link
                  href={`/source/${sourceSlug}`}
                  className="text-[11px] text-[var(--accent)] bg-[var(--surface-alt)] px-2 py-0.5 rounded-full"
                >
                  {domain}
                </Link>
              ) : (
                <span className="text-[11px] text-[var(--text-secondary)] bg-[var(--surface-alt)] px-2 py-0.5 rounded-full">
                  {domain}
                </span>
              )
            )}
            {article.published_at && (
              <span className="meta-text">{formatDistanceToNow(article.published_at)}</span>
            )}
          </div>

          <p className="text-[15px] font-semibold text-[var(--text-primary)] leading-snug mb-1">
            {article.title}
          </p>

          {(framing || resolveStoryDek(article.summary, 280)) && (
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed line-clamp-3 mt-1">
              {framing || resolveStoryDek(article.summary, 280)}
            </p>
          )}
        </div>

        {articleHref ? (
          <a
            href={articleHref}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface-alt)] transition-colors"
            aria-label="Open source"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
      </div>

      {!locked && (
        <Link
          href={`/compare?a=${article.id}`}
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          <GitCompareArrows className="h-3.5 w-3.5" />
          Compare
        </Link>
      )}
    </div>
  )
}
