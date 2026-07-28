"use client"

import Link from "next/link"
import { useState } from "react"
import type { Story } from "@/lib/types"
import { getCategoryLabel } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import { HypeRealityBar } from "./HypeRealityBar"
import { DnaTag } from "./DnaTag"
import { JargonText } from "./JargonText"
import { ArrowUpRight, Bookmark, BookmarkCheck } from "lucide-react"
import { toggleSavedStory, isStorySaved } from "@/lib/profile"

export function StoryRow({ story }: { story: Story }) {
  const [saved, setSaved] = useState(() => isStorySaved(story.id))

  const categoryLabel = getCategoryLabel(story.category || "")
  const tags = story.tags || []
  const isBreaking = tags.includes("breaking")
  const hypeScore = Math.min(100, 30 + (story.source_count || 1) * 8)

  return (
    <article className={`story-row group ${isBreaking ? "breaking-border" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)] font-bold">
            {categoryLabel}
          </span>
          <span className="font-mono text-[10px] text-[var(--text-secondary)] tabular-nums font-medium">
            [{story.source_count} src]
          </span>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            {formatDistanceToNow(story.created_at)}
          </span>
        </div>

        <Link href={`/story/${story.id}`} className="group/link block">
          <h3 className="text-[20px] md:text-[24px] font-extrabold leading-tight tracking-[-0.02em] group-hover/link:text-[var(--accent)] transition-colors">
            {story.title}
          </h3>
        </Link>

        {story.summary_en && (
          <JargonText
            text={story.summary_en}
            className="mt-1 text-[14px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed"
          />
        )}

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <div className="w-20 shrink-0">
            <HypeRealityBar score={hypeScore} size="sm" />
          </div>
          {tags.includes("hype") && <DnaTag type="hype" label="Hype" />}
          {tags.includes("kh_relevant") && <DnaTag type="kh" label="KH" />}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 mt-1 flex-shrink-0">
        <button
          onClick={(e) => {
            e.preventDefault()
            const next = toggleSavedStory(story.id)
            setSaved(next)
          }}
          className={`w-11 h-11 flex items-center justify-center transition-colors ${
            saved
              ? "text-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:text-[var(--accent)]"
          }`}
          aria-label={saved ? "Unsave story" : "Save story"}
        >
          {saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
        </button>
        <Link
          href={`/story/${story.id}`}
          className="w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] transition-colors group-hover:text-[var(--accent)]"
        >
          <ArrowUpRight className="h-5 w-5" />
        </Link>
      </div>
    </article>
  )
}
