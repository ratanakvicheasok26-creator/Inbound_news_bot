import type { Story } from "@/lib/types"
import { getCategoryLabel } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import { DnaTag } from "./DnaTag"
import { HypeRealityBar } from "./HypeRealityBar"
import { JargonText } from "./JargonText"
import Link from "next/link"
import Image from "next/image"

export function LeadStoryCard({ story }: { story: Story }) {
  const categoryLabel = getCategoryLabel(story.category || "")
  const tags = story.tags || []
  const isBreaking = tags.includes("breaking")

  // Derive a simple hype score from source_count (more sources = more attention)
  // In a real system this would come from the AI pipeline
  const hypeScore = Math.min(100, 30 + (story.source_count || 1) * 8)

  return (
    <article className={`${isBreaking ? "breaking-border" : ""}`}>
      {/* Image — full width 16:9 */}
      <div className="relative w-full aspect-[16/9] bg-[var(--surface-alt)] mb-5 overflow-hidden">
        <Image
          src="/window.svg"
          alt={story.title}
          fill
          className="object-cover"
          priority
        />
        {isBreaking && (
          <div className="absolute top-3 left-3">
            <DnaTag type="breaking" label="Breaking" />
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)] font-medium border border-[var(--accent)] px-2 py-0.5">
          {categoryLabel}
        </span>
        <span className="font-mono text-[11px] text-[var(--text-secondary)] tabular-nums">
          {story.source_count} source{story.source_count !== 1 ? "s" : ""}
        </span>
        <span className="font-mono text-[11px] text-[var(--text-secondary)]">
          &middot;
        </span>
        <span className="font-mono text-[11px] text-[var(--text-secondary)]">
          {formatDistanceToNow(story.created_at)}
        </span>
      </div>

      <Link href={`/story/${story.id}`} className="group block">
        <h1 className="font-serif text-[32px] md:text-[40px] font-bold leading-[1.1] tracking-[-0.02em] group-hover:text-[var(--red-hover)] transition-colors">
          {story.title}
        </h1>
      </Link>

      {story.summary_en && (
        <JargonText
          text={story.summary_en}
          className="mt-3 text-[16px] text-[var(--text-secondary)] leading-[1.6] max-w-[720px]"
        />
      )}

      {/* DNA tags */}
      {tags.length > 0 && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {tags.includes("hype") && <DnaTag type="hype" label="Hype" />}
          {tags.includes("kh_relevant") && <DnaTag type="kh" label="KH-relevant" />}
          {tags.includes("new_concept") && <DnaTag type="concept" label="New concept" />}
        </div>
      )}

      {/* Hype-Reality bar */}
      <div className="mt-4">
        <HypeRealityBar score={hypeScore} showLabels />
      </div>
    </article>
  )
}
