import Link from "next/link"
import type { Story } from "@/lib/types"
import { getCategoryLabel } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import { HypeRealityBar } from "./HypeRealityBar"
import { DnaTag } from "./DnaTag"
import { JargonText } from "./JargonText"
import { ArrowUpRight } from "lucide-react"

export function StoryRow({ story }: { story: Story }) {
  const categoryLabel = getCategoryLabel(story.category || "")
  const tags = story.tags || []
  const isBreaking = tags.includes("breaking")
  const hypeScore = Math.min(100, 30 + (story.source_count || 1) * 8)

  return (
    <article className={`story-row group ${isBreaking ? "breaking-border" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)] font-medium">
            {categoryLabel}
          </span>
          <span className="font-mono text-[10px] text-[var(--text-secondary)] tabular-nums">
            {story.source_count} src
          </span>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            {formatDistanceToNow(story.created_at)}
          </span>
        </div>

        <Link href={`/story/${story.id}`} className="group/link block">
          <h3 className="font-serif text-[17px] font-semibold leading-snug tracking-tight group-hover/link:text-[var(--red-hover)] transition-colors">
            {story.title}
          </h3>
        </Link>

        {story.summary_en && (
          <JargonText
            text={story.summary_en}
            className="mt-1 text-[13px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed"
          />
        )}

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {/* Mini hype bar */}
          <div className="w-16 shrink-0">
            <HypeRealityBar score={hypeScore} size="sm" />
          </div>

          {/* Tags */}
          {tags.includes("hype") && <DnaTag type="hype" label="Hype" />}
          {tags.includes("kh_relevant") && <DnaTag type="kh" label="KH" />}
        </div>
      </div>

      <Link
        href={`/story/${story.id}`}
        className="mt-1 flex-shrink-0 text-[var(--text-secondary)] transition-colors group-hover:text-[var(--red-hover)]"
      >
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </article>
  )
}
