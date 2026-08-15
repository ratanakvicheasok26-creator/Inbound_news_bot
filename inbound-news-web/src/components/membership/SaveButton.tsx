"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bookmark, BookmarkCheck, Lock } from "lucide-react"
import { useFeatureAccess } from "@/lib/membership"
import { isStorySaved, toggleSavedStory } from "@/lib/profile"
import { useI18n } from "@/lib/i18n/LocaleProvider"

/**
 * Save/bookmark button gated to Pro+. Free users see a lock button that points
 * at the pricing page instead of saving.
 */
export function SaveButton({
  storyId,
  variant = "card",
}: {
  storyId: string
  variant?: "card" | "content" | "row"
}) {
  const { t } = useI18n()
  const router = useRouter()
  const { loading, allowed } = useFeatureAccess("bookmarks")
  const [saved, setSaved] = useState(() => isStorySaved(storyId))

  if (loading) {
    return (
      <span
        aria-hidden
        className={
          variant === "content"
            ? "inline-block h-9 w-[86px] rounded-[var(--radius-sm)] bg-[var(--surface-alt)] animate-pulse"
            : variant === "row"
              ? "inline-block h-9 w-9 sm:h-10 sm:w-10 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] animate-pulse"
              : "inline-block h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] animate-pulse"
        }
      />
    )
  }

  if (!allowed) {
    return (
      <button
        type="button"
        onClick={() => router.push("/pricing")}
        aria-label={t("common.saveStory")}
        title={t("common.saveStory")}
        className={
          variant === "content"
            ? "inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-semibold rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] transition-colors"
            : variant === "row"
              ? "w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface-alt)] transition-colors"
              : "w-9 h-9 flex items-center justify-center shrink-0 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface-alt)] transition-colors"
        }
      >
        <Lock className="h-4 w-4" />
        {variant === "content" && <span>{t("common.save")}</span>}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        setSaved(toggleSavedStory(storyId))
      }}
      className={
        variant === "content"
          ? `inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-semibold rounded-[var(--radius-sm)] border border-[var(--border)] transition-colors ${
              saved
                ? "text-[var(--accent)] bg-[var(--red-subtle-bg)] border-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface-alt)]"
            }`
          : variant === "row"
            ? `w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0 rounded-[var(--radius-sm)] transition-colors ${
                saved
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface-alt)]"
              }`
            : `w-9 h-9 flex items-center justify-center shrink-0 rounded-[var(--radius-sm)] transition-colors ${
                saved
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface-alt)]"
              }`
      }
      aria-label={saved ? t("common.unsave") : t("common.saveStory")}
    >
      {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      {variant === "content" && (saved ? t("common.saved") : t("common.save"))}
    </button>
  )
}
