import Link from "next/link"
import { ExternalLink, Plus } from "lucide-react"
import type { CompareOption } from "@/lib/compare"
import { formatDate } from "@/lib/utils"

interface ArticleCardProps {
  option: CompareOption | null
  slot: "A" | "B"
  active?: boolean
  onChoose?: () => void
}

export function ArticleCard({ option, slot, active, onChoose }: ArticleCardProps) {
  const sourceName = option?.source_name || option?.source_domain || "Unknown"

  if (!option) {
    return (
      <div
        className={`flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-dashed p-6 text-center transition-colors ${
          active ? "border-[var(--accent)] bg-[var(--red-subtle-bg)]" : "border-[var(--border)] bg-[var(--surface)]"
        }`}
      >
        <span className="chip">
          Article {slot}
        </span>
        {onChoose ? (
          <button type="button" onClick={onChoose} className="btn-ghost">
            <Plus className="h-4 w-4" />
            Choose article
          </button>
        ) : (
          <p className="text-[13px] text-[var(--text-secondary)]">No article selected</p>
        )}
      </div>
    )
  }

  return (
    <article
      className={`flex h-full flex-col rounded-[var(--radius)] border bg-[var(--surface)] p-5 ${
        active ? "border-[var(--accent)]" : "border-[var(--border)]"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="chip">Article {slot}</span>
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">{sourceName}</span>
        {option.published_at && (
          <span className="meta-text">{formatDate(option.published_at)}</span>
        )}
      </div>

      <h3 className="font-display text-[17px] md:text-[19px] font-semibold leading-snug tracking-[-0.01em] mb-3">
        {option.title}
      </h3>

      {option.summary && (
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] line-clamp-3 mb-4">
          {option.summary}
        </p>
      )}

      <div className="mt-auto pt-1">
        <Link
          href={option.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
        >
          Read original
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  )
}
