import { notFound } from "next/navigation"
import { getStoriesByCategory } from "@/lib/posts"
import { CATEGORIES, getCategoryLabel } from "@/lib/categories"
import { StoryRow } from "@/components/story/StoryRow"
import { HypeRealityBar } from "@/components/story/HypeRealityBar"

function coverageScore(sourceCount: number | null | undefined): number {
  return Math.min(100, 30 + (sourceCount || 1) * 8)
}

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
  const avgCoverage =
    stories.length > 0
      ? Math.round(
          stories.reduce((sum, s) => sum + coverageScore(s.source_count), 0) / stories.length
        )
      : 0

  return (
    <div className="container">
      <section className="py-10">
        <div className="section-header">
          <h1 className="page-title text-[clamp(24px,4vw,48px)]">{label}</h1>
          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
            {stories.length} stor{stories.length !== 1 ? "ies" : "y"}
          </span>
        </div>

        {stories.length > 0 && (
          <div className="mb-8 pb-6 border-b border-[var(--border)]">
            <div className="flex items-center gap-4 mb-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Avg coverage intensity
              </span>
            </div>
            <HypeRealityBar score={avgCoverage} size="lg" showLabels />
            <p className="mt-2 font-mono text-[10px] text-[var(--text-secondary)]">
              Proxy from source density across stories in this topic — not an AI hype score.
            </p>
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
