import { getAllStories } from "@/lib/posts"
import { StoryRow } from "@/components/story/StoryRow"
import { BlindspotCard } from "@/components/story/BlindspotCard"
import { Eye } from "lucide-react"

export const metadata = {
  title: "Blindspot — Inbound Reports",
  description: "Clustered tech stories with few sources — easy to miss in mainstream feeds.",
}

export default async function BlindspotPage() {
  const stories = await getAllStories()
  const underreported = [...stories]
    .filter((s) => (s.source_count ?? 0) <= 3)
    .sort((a, b) => (a.source_count ?? 0) - (b.source_count ?? 0))
  const featured = underreported.slice(0, 4)

  return (
    <div className="container">
      <section className="py-10">
        <div className="section-header">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[var(--red-alert)]" />
            <h1 className="page-title">Coverage blindspots</h1>
          </div>
        </div>

        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed max-w-[640px] mb-8">
          Clustered stories with few sources — coverage that is easy to miss in mainstream
          tech feeds. Source count is the signal; literacy is the goal.
        </p>

        {featured.length === 0 ? (
          <p className="font-mono text-[12px] text-[var(--text-secondary)] mb-10">
            No underreported clusters yet.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 mb-10">
            {featured.map((story) => (
              <BlindspotCard
                key={story.id}
                title={story.title}
                summary={story.summary_en || undefined}
                sourceCount={story.source_count ?? 0}
                href={`/story/${story.id}`}
              />
            ))}
          </div>
        )}

        <div className="section-header">
          <h2 className="section-title">All underreported stories</h2>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            {underreported.length} stories
          </span>
        </div>
        {underreported.length === 0 ? (
          <div className="empty-state py-8">
            <p>No underreported clusters yet.</p>
          </div>
        ) : (
          <div>
            {underreported.map((story) => (
              <StoryRow key={story.id} story={story} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
