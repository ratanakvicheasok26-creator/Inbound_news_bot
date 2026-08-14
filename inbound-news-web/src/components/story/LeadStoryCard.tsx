import type { Story } from "@/lib/types"
import { getCategoryLabel } from "@/lib/categories"
import { resolveStoryDek } from "@/lib/story-body"
import { formatDistanceToNow } from "@/lib/utils"
import { StoryImage } from "@/components/story/StoryImage"
import { CoverageMeta } from "@/components/story/CoverageMeta"
import Link from "next/link"

export function LeadStoryCard({ story }: { story: Story }) {
  const categoryLabel = getCategoryLabel(story.category || "") || "News"
  const dek = resolveStoryDek(story.summary_en, 180)

  return (
    <article className="animate-[riseIn_400ms_ease-out]">
      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12 lg:items-center">
        <div className="relative overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-alt)]">
          <StoryImage
            imageUrl={story.image_url}
            pageUrl={story.primary_url}
            alt={story.title}
            variant="lead"
            priority
            className="rounded-none"
          />
        </div>

        <div className="lg:py-4">
          <div className="mb-4 flex items-center gap-2.5 flex-wrap">
            <span className="chip">{categoryLabel}</span>
            <span className="meta-text">{formatDistanceToNow(story.created_at)}</span>
          </div>

          <Link href={`/story/${story.id}`} className="group block">
            <h1 className="font-display-modern text-[clamp(28px,4.2vw,44px)] font-bold leading-[1.08] tracking-[-0.02em] transition-colors duration-200 group-hover:text-[var(--accent)]">
              {story.title}
            </h1>
          </Link>

          {dek && (
            <p className="mt-4 max-w-[52ch] text-[15px] md:text-[16px] leading-[1.6] text-[var(--text-secondary)]">
              {dek}
            </p>
          )}

          <div className="mt-4 max-w-[52ch]">
            <CoverageMeta story={story} maxNames={3} />
          </div>

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
