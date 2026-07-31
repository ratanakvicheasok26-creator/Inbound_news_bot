"use client"

import Link from "next/link"
import { useState } from "react"
import type { Story } from "@/lib/types"
import { getCategoryLabel } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import { Bookmark, BookmarkCheck } from "lucide-react"
import { toggleSavedStory, isStorySaved } from "@/lib/profile"
import { StoryImage } from "@/components/story/StoryImage"

/** Equal-weight story tile for balanced home grids. */
export function StoryCard({ story }: { story: Story }) {
  const [saved, setSaved] = useState(() => isStorySaved(story.id))
  const categoryLabel = getCategoryLabel(story.category || "") || "News"

  return (
    <article className="story-card-tile group flex flex-col h-full">
      <Link href={`/story/${story.id}`} className="block">
        <StoryImage
          imageUrl={story.image_url}
          pageUrl={story.primary_url}
          alt={story.title}
          variant="card"
          className="rounded-[var(--radius)]"
        />
      </Link>

      <div className="flex flex-1 flex-col pt-3.5">
        <div className="mb-2 flex items-center gap-2 flex-wrap">
          <span className="meta-text text-[var(--accent)]">{categoryLabel}</span>
          <span className="meta-text tabular-nums">
            {story.source_count} source{story.source_count !== 1 ? "s" : ""}
          </span>
          <span className="meta-text">{formatDistanceToNow(story.created_at)}</span>
        </div>

        <Link href={`/story/${story.id}`} className="block flex-1">
          <h3 className="font-display text-[17px] md:text-[18px] font-semibold leading-snug tracking-[-0.015em] group-hover:text-[var(--accent)] transition-colors line-clamp-3">
            {story.title}
          </h3>
        </Link>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Link
            href={`/story/${story.id}`}
            className="text-[13px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            Decode
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              const next = toggleSavedStory(story.id)
              setSaved(next)
            }}
            className={`w-9 h-9 flex items-center justify-center shrink-0 rounded-[var(--radius-sm)] transition-colors ${
              saved
                ? "text-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface-alt)]"
            }`}
            aria-label={saved ? "Unsave story" : "Save story"}
          >
            {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </article>
  )
}
