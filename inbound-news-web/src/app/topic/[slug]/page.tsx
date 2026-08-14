import { notFound } from "next/navigation"
import { getStoriesByCategorySafe } from "@/lib/posts"
import { prioritizeStoriesWithImages } from "@/lib/story-priority"
import { CATEGORIES, getCategoryLabel } from "@/lib/categories"
import { StoryRow } from "@/components/story/StoryRow"
import { FollowButton } from "@/components/FollowButton"
import { isMockStoriesEnabled } from "@/lib/mock-stories"

export const revalidate = 60

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  if (!CATEGORIES.some((c) => c.slug === slug)) {
    notFound()
  }

  const { stories: raw, error } = await getStoriesByCategorySafe(slug)
  const stories = await prioritizeStoriesWithImages(raw, {
    resolveLimit: isMockStoriesEnabled() ? 0 : 4,
    concurrency: 2,
  })
  const label = getCategoryLabel(slug)

  return (
    <div className="container py-10 md:py-14">
      <div className="section-header">
        <div>
          <h1 className="page-title">{label}</h1>
          <p className="mt-2 text-[13px] text-[var(--text-secondary)] max-w-[48ch]">
            Follow this desk to track it in your account diet. Ranking stays chronological for now.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FollowButton kind="topic" slug={slug} label={`Follow ${label}`} />
          <span className="meta-text">
            {stories.length} stor{stories.length !== 1 ? "ies" : "y"}
          </span>
        </div>
      </div>

      {error ? (
        <div className="empty-state">
          <p className="page-title mb-2">Could not load this desk</p>
          <p>{error}</p>
        </div>
      ) : stories.length === 0 ? (
        <div className="empty-state">
          <p>Nothing on this desk yet.</p>
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] px-5 md:px-6">
          {stories.map((story) => (
            <StoryRow key={story.id} story={story} />
          ))}
        </div>
      )}
    </div>
  )
}
