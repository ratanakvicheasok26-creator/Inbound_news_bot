import type { Story } from "@/lib/types"
import { getCategoryLabel } from "@/lib/categories"
import { resolveStoryDek } from "@/lib/story-body"
import { formatDistanceToNow } from "@/lib/utils"
import { StoryImage } from "@/components/story/StoryImage"
import Link from "next/link"

export function LeadStoryCard({ story }: { story: Story }) {
  const categoryLabel = getCategoryLabel(story.category || "") || "News"
  const dek = resolveStoryDek(story.summary_en, 180)

  return (
    <article className="animate-[riseIn_400ms_ease-out]">
      <div className="grid gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-10 lg:items-end">
        <StoryImage
          imageUrl={story.image_url}
          pageUrl={story.primary_url}
          alt={story.title}
          variant="lead"
          priority
          className="rounded-[var(--radius)]"
        />

        <div>
          <div className="mb-3 flex items-center gap-3 flex-wrap">
            <span className="meta-text text-[var(--accent)]">{categoryLabel}</span>
            <span className="meta-text">
              {story.source_count} source{story.source_count !== 1 ? "s" : ""}
            </span>
            <span className="meta-text">{formatDistanceToNow(story.created_at)}</span>
          </div>

          <Link href={`/story/${story.id}`} className="group block">
            <h1 className="font-display text-[clamp(26px,3.8vw,40px)] font-semibold leading-[1.12] tracking-[-0.025em] group-hover:text-[var(--accent)] transition-colors">
              {story.title}
            </h1>
          </Link>

          {dek && (
            <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.55] text-[var(--text-secondary)]">
              {dek}
            </p>
          )}

          <div className="mt-6">
            <Link href={`/story/${story.id}`} className="btn-primary">
              Decode this story
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
