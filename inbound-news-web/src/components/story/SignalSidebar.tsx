import type { Story } from "@/lib/types"
import { getCategoryLabel } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import { HypeRealityBar } from "./HypeRealityBar"
import Link from "next/link"

export function SignalSidebar({ stories }: { stories: Story[] }) {
  if (stories.length === 0) return null

  return (
    <aside>
      <div className="section-header mb-4">
        <h2 className="section-title">Today&apos;s Signal</h2>
      </div>
      <ol className="space-y-0">
        {stories.map((story, i) => {
          const hypeScore = Math.min(100, 30 + (story.source_count || 1) * 8)
          return (
            <li key={story.id} className="flex gap-3 py-3 border-b border-[var(--border)] last:border-0 group">
              <span className="text-[24px] font-extrabold text-[var(--accent)] tabular-nums leading-none mt-0.5 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-secondary)] font-bold">
                    {getCategoryLabel(story.category || "")}
                  </span>
                  <span className="font-mono text-[9px] text-[var(--text-secondary)]">
                    {formatDistanceToNow(story.created_at)}
                  </span>
                </div>
                <Link href={`/story/${story.id}`}>
                  <h3 className="text-[14px] font-bold leading-snug tracking-tight group-hover:text-[var(--accent)] transition-colors">
                    {story.title}
                  </h3>
                </Link>
                <div className="mt-1.5">
                  <HypeRealityBar score={hypeScore} size="sm" />
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
