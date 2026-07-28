"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Bookmark, X } from "lucide-react"
import { getProfile, toggleSavedStory, toggleFollowedConcept } from "@/lib/profile"
import { getCategoryLabel } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import type { Story } from "@/lib/types"

export function LibraryTab() {
  const [savedIds, setSavedIds] = useState<string[]>(() => getProfile().savedStoryIds)
  const [concepts, setConcepts] = useState<string[]>(() => getProfile().followedConcepts)
  const [stories, setStories] = useState<Record<string, Story>>({})

  useEffect(() => {
    if (savedIds.length === 0) return
    const fetchStories = async () => {
      const { getAllStories } = await import("@/lib/posts")
      const all = await getAllStories()
      const map: Record<string, Story> = {}
      for (const s of all) {
        if (savedIds.includes(s.id)) map[s.id] = s
      }
      setStories(map)
    }
    fetchStories()
  }, [savedIds])

  function handleUnsave(id: string) {
    toggleSavedStory(id)
    setSavedIds((prev) => prev.filter((s) => s !== id))
  }

  function handleUnfollow(slug: string) {
    toggleFollowedConcept(slug)
    setConcepts((prev) => prev.filter((c) => c !== slug))
  }

  return (
    <div>
      {/* Saved Stories */}
      <div className="mb-10">
        <div className="section-header">
          <h2 className="section-title">Saved Stories</h2>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            {savedIds.length}
          </span>
        </div>

        {savedIds.length === 0 ? (
          <div className="empty-state py-12">
            <p className="story-title mb-2">No saved stories</p>
            <p>Bookmark articles to build your library.</p>
          </div>
        ) : (
          <div>
            {savedIds.map((id) => {
              const story = stories[id]
              if (!story) {
                return (
                  <div key={id} className="flex items-center justify-between py-4 border-b border-[var(--border)]">
                    <span className="font-mono text-[12px] text-[var(--text-secondary)]">{id}</span>
                    <button
                      onClick={() => handleUnsave(id)}
                      className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                    >
                      <Bookmark className="h-4 w-4 fill-current" />
                    </button>
                  </div>
                )
              }
              return (
                <div key={id} className="flex items-start gap-3 py-4 border-b border-[var(--border)]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)] font-bold">
                        {getCategoryLabel(story.category || "")}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                        {formatDistanceToNow(story.created_at)}
                      </span>
                    </div>
                    <Link
                      href={`/story/${story.id}`}
                      className="story-title hover:text-[var(--accent)] transition-colors line-clamp-2"
                    >
                      {story.title}
                    </Link>
                    {story.summary_en && (
                      <p className="text-[13px] text-[var(--text-secondary)] line-clamp-1 mt-1">
                        {story.summary_en}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleUnsave(id)}
                    className="flex-shrink-0 mt-1 w-8 h-8 flex items-center justify-center text-[var(--accent)] hover:text-[var(--red-hover)] transition-colors"
                    aria-label="Unsave story"
                  >
                    <Bookmark className="h-4 w-4 fill-current" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Followed Concepts */}
      <div>
        <div className="section-header">
          <h2 className="section-title">Followed Concepts</h2>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            {concepts.length}
          </span>
        </div>

        {concepts.length === 0 ? (
          <div className="empty-state py-12">
            <p className="story-title mb-2">No followed concepts</p>
            <p>Visit a story and follow a concept to start tracking.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {concepts.map((slug) => (
              <div
                key={slug}
                className="group flex items-center gap-1.5 border-2 border-[var(--text-primary)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider font-bold text-[var(--text-primary)]"
              >
                <Link href={`/concept/${slug}`} className="hover:text-[var(--accent)] transition-colors">
                  {slug}
                </Link>
                <button
                  onClick={() => handleUnfollow(slug)}
                  className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors ml-1"
                  aria-label={`Unfollow ${slug}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
