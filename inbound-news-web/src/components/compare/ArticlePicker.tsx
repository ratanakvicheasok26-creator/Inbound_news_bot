import { Check } from "lucide-react"
import Link from "next/link"
import type { CompareOption } from "@/lib/compare"
import { formatDistanceToNow } from "@/lib/utils"

interface ArticlePickerProps {
  options: CompareOption[]
  excludeIds: string[]
  selectedId: string | null
  onSelect: (option: CompareOption) => void
  contextLabel?: string | null
}

export function ArticlePicker({
  options,
  excludeIds,
  selectedId,
  onSelect,
  contextLabel,
}: ArticlePickerProps) {
  const list = options.filter((opt) => !excludeIds.includes(opt.id))

  return (
    <div>
      {contextLabel && (
        <p className="meta-text mb-3 text-[var(--accent)]">{contextLabel}</p>
      )}

      {list.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] py-10 text-center">
          <p className="text-[15px] text-[var(--text-primary)] mb-1">
            No related articles available
          </p>
          <p className="text-[13px] text-[var(--text-secondary)]">
            This story may only have a single source. Try finding another article on the{" "}
            <Link href="/search" className="text-[var(--accent)] hover:underline">
              search page
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] divide-y divide-[var(--border)]">
          {list.map((opt) => {
            const selected = opt.id === selectedId
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelect(opt)}
                className={`block w-full text-left px-5 py-4 transition-colors hover:bg-[var(--surface-alt)] ${
                  selected ? "bg-[var(--surface-alt)]" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                    {opt.source_name || opt.source_domain || "Unknown"}
                  </span>
                  {opt.storyTitle && <span className="meta-text truncate">{opt.storyTitle}</span>}
                  {opt.published_at && (
                    <span className="meta-text">{formatDistanceToNow(opt.published_at)}</span>
                  )}
                  {selected && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                      <Check className="h-3.5 w-3.5" />
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-[15px] font-semibold leading-snug line-clamp-2 text-[var(--text-primary)]">
                  {opt.title}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
