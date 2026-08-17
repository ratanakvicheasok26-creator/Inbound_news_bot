"use client"

import Link from "next/link"
import type { Story } from "@/lib/types"
import { CATEGORY_MAP } from "@/lib/categories"
import { resolveStoryDek } from "@/lib/story-body"
import { formatDistanceToNow } from "@/lib/utils"
import { StoryImage } from "@/components/story/StoryImage"
import { CoverageMeta } from "@/components/story/CoverageMeta"
import { SaveButton } from "@/components/membership/SaveButton"
import { useI18n } from "@/lib/i18n/LocaleProvider"

interface FeaturedEditorialGridProps {
  leadStory: Story
  secondaryStories: Story[]
}

export function FeaturedEditorialGrid({
  leadStory,
  secondaryStories,
}: FeaturedEditorialGridProps) {
  const { t } = useI18n()

  const leadSlug = leadStory.category || ""
  const leadCategoryLabel = CATEGORY_MAP[leadSlug]
    ? t(`category.${leadSlug}`)
    : t("common.news")
  const leadDek = resolveStoryDek(leadStory.summary_en, 190)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
      {/* Featured Large Story (Span 7 cols) */}
      <article className="lg:col-span-7 flex flex-col group min-w-0">
        <div className="image-bleed-effect rounded-2xl mb-6 overflow-hidden bg-[var(--surface-alt)] border border-[var(--border)]">
          <Link href={`/story/${leadStory.id}`} className="block relative z-10 overflow-hidden">
            <StoryImage
              imageUrl={leadStory.image_url}
              pageUrl={leadStory.primary_url}
              alt={leadStory.title}
              variant="lead"
              priority
              className="rounded-none transform group-hover:scale-[1.02] transition-transform duration-500 ease-out"
            />
          </Link>
        </div>

        <div className="flex flex-col flex-grow justify-start">
          <div className="flex items-center space-x-3 mb-3.5 flex-wrap">
            <span className="px-2.5 py-1 rounded-md bg-[var(--red-subtle-bg)] text-[var(--accent)] text-xs font-bold uppercase tracking-wider">
              {leadCategoryLabel}
            </span>
            <span className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider">
              {formatDistanceToNow(leadStory.created_at)}
            </span>
          </div>

          <Link href={`/story/${leadStory.id}`} className="block">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display-modern text-[var(--text-primary)] mb-3.5 leading-[1.15] group-hover:text-[var(--accent)] transition-colors">
              {leadStory.title}
            </h3>
          </Link>

          {leadDek && (
            <p className="text-base md:text-lg text-[var(--text-secondary)] mb-6 leading-relaxed line-clamp-3">
              {leadDek}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 mt-auto pt-4 border-t border-[var(--border)]">
            <CoverageMeta story={leadStory} maxNames={3} />
            <div className="flex items-center gap-3 shrink-0">
              <SaveButton storyId={leadStory.id} />
              <Link
                href={`/story/${leadStory.id}`}
                className="btn-primary text-xs sm:text-sm py-2 px-4"
              >
                {t("story.decodeThis")}
              </Link>
            </div>
          </div>
        </div>
      </article>

      {/* Right Side Stacked Stories (Span 5 cols) */}
      <div className="lg:col-span-5 flex flex-col space-y-6 sm:space-y-8 justify-between">
        {secondaryStories.map((story) => {
          const slug = story.category || ""
          const categoryLabel = CATEGORY_MAP[slug]
            ? t(`category.${slug}`)
            : t("common.news")
          const dek = resolveStoryDek(story.summary_en, 110)

          return (
            <article
              key={story.id}
              className="flex flex-col sm:flex-row gap-5 sm:gap-6 group min-w-0 border-b border-[var(--border)] last:border-0 pb-6 sm:pb-8 last:pb-0"
            >
              <div className="sm:w-1/3 shrink-0 image-bleed-effect-sm rounded-xl overflow-hidden bg-[var(--surface-alt)] border border-[var(--border)] self-start w-full aspect-[4/3]">
                <Link
                  href={`/story/${story.id}`}
                  className="block h-full relative z-10 overflow-hidden"
                >
                  <StoryImage
                    imageUrl={story.image_url}
                    pageUrl={story.primary_url}
                    alt={story.title}
                    variant="card"
                    className="h-full w-full object-cover rounded-none transform group-hover:scale-105 transition-transform duration-500 ease-out"
                  />
                </Link>
              </div>

              <div className="flex flex-col justify-between sm:w-2/3 min-w-0">
                <div>
                  <div className="flex items-center space-x-2.5 mb-2 flex-wrap">
                    <span className="text-[var(--accent)] text-[11px] font-bold uppercase tracking-wider">
                      {categoryLabel}
                    </span>
                    <span className="text-[var(--text-secondary)] text-[11px] font-medium uppercase tracking-wider">
                      {formatDistanceToNow(story.created_at)}
                    </span>
                  </div>

                  <Link href={`/story/${story.id}`} className="block">
                    <h4 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-2 leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2">
                      {story.title}
                    </h4>
                  </Link>

                  {dek && (
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-2 mb-3 leading-relaxed">
                      {dek}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[var(--border)]/60">
                  <CoverageMeta story={story} maxNames={2} compact showBar={false} />
                  <SaveButton storyId={story.id} />
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
