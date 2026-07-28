import { notFound } from "next/navigation"
import { getStoriesByCategory } from "@/lib/posts"
import { CATEGORIES, getCategoryLabel } from "@/lib/categories"
import { StoryRow } from "@/components/story/StoryRow"
import { HypeRealityBar } from "@/components/story/HypeRealityBar"

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  if (!CATEGORIES.some((c) => c.slug === slug)) {
    notFound()
  }

  const stories = await getStoriesByCategory(slug)
  const label = getCategoryLabel(slug)

  return (
    <div className="container">
      <section className="py-10">
        <div className="section-header">
          <h1 className="page-title text-[24px]">{label}</h1>
          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
            {stories.length} stor{stories.length !== 1 ? "ies" : "y"}
          </span>
        </div>

        {/* Category hype distribution */}
        {stories.length > 0 && (
          <div className="mb-8 pb-6 border-b border-[var(--border)]">
            <div className="flex items-center gap-4 mb-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Coverage Hype Distribution
              </span>
            </div>
            <HypeRealityBar score={50} size="lg" showLabels />
          </div>
        )}

        {stories.length === 0 ? (
          <div className="empty-state">
            <p>Nothing on this desk yet.</p>
          </div>
        ) : (
          <div>
            {stories.map((story) => (
              <StoryRow key={story.id} story={story} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
