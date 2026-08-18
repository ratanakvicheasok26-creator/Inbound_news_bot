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
  const leadDek = resolveStoryDek(leadStory.summary_en, 180)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
      {/* Featured Large Story (Span 7 cols) */}
      <article className="lg:col-span-7 flex flex-col group cursor-pointer min-w-0">
        <div className="image-bleed-effect rounded-xl mb-4 sm:mb-6 overflow-hidden">
          <Link href={`/story/${leadStory.id}`} className="block relative z-10 overflow-hidden">
            <StoryImage
              imageUrl={leadStory.image_url}
              pageUrl={leadStory.primary_url}
              alt={leadStory.title}
              variant="lead"
              priority
              className="w-full h-auto rounded-xl object-cover shadow-glow-red relative z-10 border border-neutral-800 transform group-hover:scale-105 transition-transform duration-500"
            />
          </Link>
        </div>

        <div className="flex flex-col flex-grow justify-start">
          <div className="flex items-center space-x-2.5 sm:space-x-3 mb-3 sm:mb-4 flex-wrap">
            <span className="px-2.5 py-1 rounded-md bg-[#ff0033]/10 border border-[#ff0033]/20 text-[var(--accent)] text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              {leadCategoryLabel}
            </span>
            <span className="text-[var(--text-secondary)] text-[11px] sm:text-xs font-medium uppercase tracking-wider">
              {formatDistanceToNow(leadStory.created_at)}
            </span>
          </div>

          <Link href={`/story/${leadStory.id}`} className="block">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-3 sm:mb-4 leading-tight group-hover:text-[var(--accent)] transition-colors line-clamp-3 sm:line-clamp-none">
              {leadStory.title}
            </h3>
          </Link>

          {leadDek && (
            <p className="text-base sm:text-lg text-[var(--text-secondary)] mb-4 sm:mb-6 leading-relaxed line-clamp-2 sm:line-clamp-3">
              {leadDek}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 sm:gap-4 mt-auto pt-2 flex-wrap sm:flex-nowrap">
            <CoverageMeta story={leadStory} maxNames={2} compact />
            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
              <SaveButton storyId={leadStory.id} />
              <Link
                href={`/story/${leadStory.id}`}
                className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                {t("story.decodeThis")} &rarr;
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
              className="flex flex-col sm:flex-row gap-4 sm:gap-6 group cursor-pointer border-b border-[var(--border)] pb-6 sm:pb-8 last:border-0 last:pb-0 min-w-0"
            >
              <div className="sm:w-2/5 md:w-1/3 shrink-0 image-bleed-effect-sm rounded-lg overflow-hidden w-full aspect-[16/10] sm:aspect-[4/3]">
                <Link
                  href={`/story/${story.id}`}
                  className="block h-full relative z-10 overflow-hidden"
                >
                  <StoryImage
                    imageUrl={story.image_url}
                    pageUrl={story.primary_url}
                    alt={story.title}
                    variant="card"
                    className="w-full h-full object-cover rounded-lg shadow-glow-red-sm relative z-10 border border-[var(--border)] transform group-hover:scale-105 transition-transform duration-500"
                  />
                </Link>
              </div>

              <div className="flex flex-col justify-center sm:w-3/5 md:w-2/3 min-w-0">
                <div className="flex items-center space-x-2.5 sm:space-x-3 mb-2 flex-wrap">
                  <span className="text-[var(--accent)] text-[10px] font-bold uppercase tracking-wider">
                    {categoryLabel}
                  </span>
                  <span className="text-[var(--text-secondary)] text-[10px] font-medium uppercase tracking-wider">
                    {formatDistanceToNow(story.created_at)}
                  </span>
                </div>

                <Link href={`/story/${story.id}`} className="block">
                  <h4 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] mb-1.5 sm:mb-2 leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2">
                    {story.title}
                  </h4>
                </Link>

                {dek && (
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-2 mb-2.5 sm:mb-3 leading-relaxed">
                    {dek}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 mt-auto">
                  <span className="text-[10px] text-[var(--text-secondary)] font-medium truncate">
                    {story.primary_source || story.primary_source_domain || "Tech News"}
                  </span>
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
