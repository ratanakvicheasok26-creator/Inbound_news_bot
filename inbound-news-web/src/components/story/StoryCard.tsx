"use client"

import Link from "next/link"
import type { Story } from "@/lib/types"
import { CATEGORY_MAP } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import { StoryImage } from "@/components/story/StoryImage"
import { CoverageMeta } from "@/components/story/CoverageMeta"
import { SaveButton } from "@/components/membership/SaveButton"
import { useI18n } from "@/lib/i18n/LocaleProvider"

/** Equal-weight story tile for balanced home grids. */
export function StoryCard({ story }: { story: Story }) {
  const { t } = useI18n()
  const slug = story.category || ""
  const categoryLabel = CATEGORY_MAP[slug] ? t(`category.${slug}`) : t("common.news")

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] transition-colors duration-200 hover:border-[var(--text-secondary)]">
      <Link href={`/story/${story.id}`} className="block shrink-0">
        <StoryImage
          imageUrl={story.image_url}
          pageUrl={story.primary_url}
          alt={story.title}
          variant="card"
          className="rounded-none"
        />
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="mb-2.5 flex items-center gap-2 flex-wrap">
          <span className="chip">{categoryLabel}</span>
          <span className="meta-text">{formatDistanceToNow(story.created_at)}</span>
        </div>

        <Link href={`/story/${story.id}`} className="block flex-1">
          <h3 className="font-display-modern text-[17px] md:text-[18px] font-semibold leading-snug tracking-[-0.015em] transition-colors duration-200 group-hover:text-[var(--accent)] line-clamp-3">
            {story.title}
          </h3>
        </Link>

        <div className="mt-3">
          <CoverageMeta story={story} maxNames={2} compact />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
          <Link
            href={`/story/${story.id}`}
            className="text-[13px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            {t("common.decode")}
          </Link>
          <SaveButton storyId={story.id} />
        </div>
      </div>
    </article>
  )
}
