"use client"

import Link from "next/link"
import { useState } from "react"
import type { Story } from "@/lib/types"
import { getCategoryLabel } from "@/lib/categories"
import { resolveStoryDek } from "@/lib/story-body"
import { formatDistanceToNow } from "@/lib/utils"
import { Bookmark, BookmarkCheck } from "lucide-react"
import { toggleSavedStory, isStorySaved } from "@/lib/profile"
import { StoryImage } from "@/components/story/StoryImage"
import { CoverageMeta } from "@/components/story/CoverageMeta"

export function StoryRow({ story }: { story: Story }) {
  const [saved, setSaved] = useState(() => isStorySaved(story.id))
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
          <CoverageMeta story={story} showBar={false} maxNames={3} />
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          const next = toggleSavedStory(story.id)
          setSaved(next)
        }}
        className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0 rounded-[var(--radius-sm)] transition-colors ${
          saved
            ? "text-[var(--accent)]"
            : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface-alt)]"
        }`}
        aria-label={saved ? "Unsave story" : "Save story"}
      >
        {saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
      </button>
    </article>
  )
}
