import { notFound } from "next/navigation"
import { getStoriesByCategory } from "@/lib/posts"
import { prioritizeStoriesWithImages } from "@/lib/story-priority"
import { CATEGORIES, getCategoryLabel } from "@/lib/categories"
import { StoryRow } from "@/components/story/StoryRow"

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  if (!CATEGORIES.some((c) => c.slug === slug)) {
    notFound()
  }

  const stories = await prioritizeStoriesWithImages(await getStoriesByCategory(slug))
  const label = getCategoryLabel(slug)

  return (
    <div className="container py-10 md:py-14">
      <div className="section-header">
        <h1 className="page-title">{label}</h1>
        <span className="meta-text">
          {stories.length} stor{stories.length !== 1 ? "ies" : "y"}
        </span>
      </div>

      {stories.length === 0 ? (
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
