import type { Story } from "@/lib/types"
import { getCategoryLabel } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import Link from "next/link"

export function SignalSidebar({ stories }: { stories: Story[] }) {
  if (stories.length === 0) return null

  return (
    <ol className="space-y-0">
      {stories.map((story, i) => (
        <li
          key={story.id}
          className="flex gap-3 py-3.5 border-b border-[var(--border)] last:border-0 group"
        >
          <span className="font-display text-[20px] font-semibold text-[var(--accent)] tabular-nums leading-none mt-0.5 shrink-0">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2 flex-wrap">
              <span className="meta-text">
                {getCategoryLabel(story.category || "") || "News"}
              </span>
              <span className="meta-text tabular-nums">
                {story.source_count} source{story.source_count !== 1 ? "s" : ""}
              </span>
              <span className="meta-text">{formatDistanceToNow(story.created_at)}</span>
            </div>
            <Link href={`/story/${story.id}`}>
              <h3 className="text-[15px] font-semibold leading-snug tracking-tight group-hover:text-[var(--accent)] transition-colors">
                {story.title}
              </h3>
            </Link>
          </div>
        </li>
      ))}
    </ol>
  )
}
