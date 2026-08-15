"use client"

import Link from "next/link"
import type { Story } from "@/lib/types"
import { getCategoryLabel } from "@/lib/categories"
import { resolveStoryDek } from "@/lib/story-body"
import { formatDistanceToNow } from "@/lib/utils"
import { StoryImage } from "@/components/story/StoryImage"
import { CoverageMeta } from "@/components/story/CoverageMeta"
import { SaveButton } from "@/components/membership/SaveButton"

export function StoryRow({ story }: { story: Story }) {
  const categoryLabel = getCategoryLabel(story.category || "") || "News"
  const dek = resolveStoryDek(story.summary_en)

  return (
    <article className="story-row group">
      <Link href={`/story/${story.id}`} className="shrink-0">
        <StoryImage
          imageUrl={story.image_url}
          pageUrl={story.primary_url}
          alt=""
          variant="thumb"
        />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2 flex-wrap">
          <span className="meta-text text-[var(--accent)]">{categoryLabel}</span>
          <span className="meta-text">{formatDistanceToNow(story.created_at)}</span>
        </div>

        <Link href={`/story/${story.id}`} className="block">
          <h3 className="font-display text-[18px] md:text-[20px] font-semibold leading-snug tracking-[-0.015em] group-hover:text-[var(--accent)] transition-colors">
            {story.title}
          </h3>
        </Link>

        {dek && (
          <p className="mt-1.5 text-[14px] text-[var(--text-secondary)] line-clamp-1 leading-relaxed">
            {dek}
          </p>
        )}

        <div className="mt-2">
          <CoverageMeta story={story} showBar={false} maxNames={3} compact />
        </div>
      </div>

      <SaveButton storyId={story.id} variant="row" />
    </article>
  )
}
