import type { Story } from "@/lib/types"
import { getCategoryLabel } from "@/lib/categories"
import { resolveStoryDek } from "@/lib/story-body"
import { formatDistanceToNow } from "@/lib/utils"
import { HypeRealityBar } from "./HypeRealityBar"
import Link from "next/link"

interface TrendingStripProps {
  stories: Story[]
}

export function TrendingStrip({ stories }: TrendingStripProps) {
  if (stories.length === 0) return null

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 -mx-32 px-32 snap-x snap-mandatory">
      {stories.map((story) => {
        const hypeScore = Math.min(100, 30 + (story.source_count || 1) * 8)
        const dek = resolveStoryDek(story.summary_en)
        return (
          <Link
            key={story.id}
            href={`/story/${story.id}`}
            className="story-card snap-start shrink-0 w-[280px] md:w-[320px]"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)] font-bold">
                {getCategoryLabel(story.category || "")}
              </span>
              <span className="font-mono text-[10px] text-[var(--text-secondary)] tabular-nums font-medium">
                [{story.source_count} src]
              </span>
            </div>
            <h3 className="story-title line-clamp-2 mb-2">
              {story.title}
            </h3>
            {dek && (
              <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed mb-3">
                {dek}
              </p>
            )}
            <div className="flex items-center gap-3">
              <div className="w-12 shrink-0">
                <HypeRealityBar score={hypeScore} size="sm" />
              </div>
              <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                {formatDistanceToNow(story.created_at)}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
