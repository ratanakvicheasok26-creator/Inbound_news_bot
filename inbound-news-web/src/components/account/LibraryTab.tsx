"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Bookmark, X } from "lucide-react"
import { getProfile, toggleSavedStory, toggleFollowedConcept, toggleFollowedTopic } from "@/lib/profile"
import { CATEGORY_MAP } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import { SyncSavesPrompt } from "@/components/account/SyncSavesPrompt"
import { FeatureGate } from "@/components/membership/FeatureGate"
import { supabase } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import type { Story } from "@/lib/types"

export function LibraryTab() {
  const { t } = useI18n()
  const [savedIds, setSavedIds] = useState<string[]>(() => getProfile().savedStoryIds)
  const [concepts, setConcepts] = useState<string[]>(() => getProfile().followedConcepts)
  const [topics, setTopics] = useState<string[]>(() => getProfile().followedTopics || [])
  const [stories, setStories] = useState<Record<string, Story>>({})
  const [loading, setLoading] = useState(false)
  const [isGuest, setIsGuest] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setIsGuest(!user))
  }, [])

  useEffect(() => {
    if (savedIds.length === 0) return
    let cancelled = false
    const fetchStories = async () => {
      setLoading(true)
      try {
        const { getStoriesByIds } = await import("@/lib/posts")
        const rows = await getStoriesByIds(savedIds)
        if (cancelled) return
        const map: Record<string, Story> = {}
        for (const s of rows) map[s.id] = s
        setStories(map)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchStories()
    return () => {
      cancelled = true
    }
  }, [savedIds])

  function handleUnsave(id: string) {
    toggleSavedStory(id)
    setSavedIds((prev) => prev.filter((s) => s !== id))
  }

  function handleUnfollow(slug: string) {
    toggleFollowedConcept(slug)
    setConcepts((prev) => prev.filter((c) => c !== slug))
  }

  function handleUnfollowTopic(slug: string) {
    toggleFollowedTopic(slug)
    setTopics((prev) => prev.filter((t) => t !== slug))
  }

  return (
    <div>
      {isGuest && savedIds.length > 0 && <SyncSavesPrompt variant="inline" force />}

      <div className="mb-10">
        <FeatureGate feature="bookmarks">
          <div className="section-header">
            <h2 className="section-title">{t("account.library.savedStories")}</h2>
            <span className="meta-text">{savedIds.length}</span>
          </div>

          {savedIds.length === 0 ? (
            <div className="empty-state py-12">
              <p className="story-title mb-2">{t("account.library.noSavedTitle")}</p>
              <p>{t("account.library.noSavedBody")}</p>
            </div>
          ) : loading ? (
            <p className="meta-text py-8">{t("account.library.loadingSaved")}</p>
          ) : (
            <div>
              {savedIds.map((id) => {
                const story = stories[id]
                if (!story) {
                  return (
                    <div key={id} className="flex items-center justify-between py-4 border-b border-[var(--border)]">
                      <span className="meta-text">{t("account.library.storyUnavailable")}</span>
                      <button
                        onClick={() => handleUnsave(id)}
                        className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                        aria-label={t("account.library.removeSaved")}
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
                        <span className="meta-text text-[var(--accent)]">
                          {CATEGORY_MAP[story.category || ""]
                            ? t(`category.${story.category}`)
                            : t("common.news")}
                        </span>
                        <span className="meta-text">
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
                      className="flex-shrink-0 mt-1 w-8 h-8 flex items-center justify-center text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                      aria-label={t("common.unsave")}
                    >
                      <Bookmark className="h-4 w-4 fill-current" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </FeatureGate>
      </div>

      {(topics.length > 0 || concepts.length > 0) && (
        <div className="space-y-8">
          {topics.length > 0 && (
            <div>
              <div className="section-header">
                <h2 className="section-title">{t("account.library.followedDesks")}</h2>
                <span className="meta-text">{topics.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {topics.map((slug) => (
                  <div
                    key={slug}
                    className="group flex items-center gap-1.5 border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-primary)]"
                  >
                    <Link href={`/topic/${slug}`} className="hover:text-[var(--accent)] transition-colors">
                      {CATEGORY_MAP[slug] ? t(`category.${slug}`) : slug}
                    </Link>
                    <button
                      onClick={() => handleUnfollowTopic(slug)}
                      className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors ml-1"
                      aria-label={t("account.library.unfollow", { name: slug })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {concepts.length > 0 && (
            <div>
              <div className="section-header">
                <h2 className="section-title">{t("account.library.followedConcepts")}</h2>
                <span className="meta-text">{concepts.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {concepts.map((slug) => (
                  <div
                    key={slug}
                    className="group flex items-center gap-1.5 border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-primary)]"
                  >
                    <Link href={`/concept/${slug}`} className="hover:text-[var(--accent)] transition-colors">
                      {slug}
                    </Link>
                    <button
                      onClick={() => handleUnfollow(slug)}
                      className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors ml-1"
                      aria-label={t("account.library.unfollow", { name: slug })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
