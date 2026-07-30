import type { Story } from "@/lib/types"
import { getCategoryLabel } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import { DnaTag } from "./DnaTag"
import { HypeRealityBar } from "./HypeRealityBar"
import { JargonText } from "./JargonText"
import Link from "next/link"

export function LeadStoryCard({ story }: { story: Story }) {
  const categoryLabel = getCategoryLabel(story.category || "")
  const tags = story.tags || []
  const isBreaking = tags.includes("breaking")
  const hypeScore = Math.min(100, 30 + (story.source_count || 1) * 8)

  return (
    <article className={`${isBreaking ? "breaking-border" : ""}`}>
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)] font-bold border-2 border-[var(--accent)] px-2 py-0.5">
          {categoryLabel}
        </span>
        <span className="font-mono text-[11px] text-[var(--text-secondary)] tabular-nums font-medium">
          {story.source_count} source{story.source_count !== 1 ? "s" : ""}
        </span>
        <span className="font-mono text-[11px] text-[var(--text-secondary)]">&middot;</span>
        <span className="font-mono text-[11px] text-[var(--text-secondary)]">
          {formatDistanceToNow(story.created_at)}
        </span>
        {isBreaking && <DnaTag type="breaking" label="Breaking" />}
      </div>

      <Link href={`/story/${story.id}`} className="group block">
        <h1 className="text-[40px] md:text-[64px] font-extrabold leading-[0.95] tracking-[-0.04em] group-hover:text-[var(--accent)] transition-colors">
          {story.title}
        </h1>
      </Link>

      <div className="mt-4 max-w-[65ch]">
        {story.summary_en && (
          <JargonText
            text={story.summary_en}
            className="text-[18px] text-[var(--text-secondary)] leading-[1.6]"
          />
        )}

        {tags.length > 0 && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {tags.includes("hype") && <DnaTag type="hype" label="Hype" />}
            {tags.includes("kh_relevant") && <DnaTag type="kh" label="KH-relevant" />}
            {tags.includes("new_concept") && <DnaTag type="concept" label="New concept" />}
          </div>
        )}

        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
            Coverage intensity
          </p>
          <HypeRealityBar score={hypeScore} showLabels />
        </div>
      </div>
    </article>
  )
}
