import { getAllStoriesSafe } from "@/lib/posts"
import { StoryRow } from "@/components/story/StoryRow"
import { BlindspotCard } from "@/components/story/BlindspotCard"
import { blindspotScore } from "@/lib/outlet-roles"
import { filterTechStories } from "@/lib/tech-scope"
import { Eye } from "lucide-react"

export const metadata = {
  title: "Blindspot — Inbound Reports",
  description:
    "Undercovered technology stories in our cluster graph — single-outlet tech coverage worth noticing.",
}

export default async function BlindspotPage() {
  const { stories: raw, error } = await getAllStoriesSafe(80)
  const stories = filterTechStories(raw)
  const underreported = [...stories]
    .filter((s) => (s.source_count ?? 0) === 1)
    .sort(
      (a, b) =>
        blindspotScore(b) - blindspotScore(a) ||
        Date.parse(b.created_at || "") - Date.parse(a.created_at || "")
    )
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
          Undercovered technology stories in our cluster graph — single-outlet tech coverage
          ranked for signal (useful summary, non-forum sources, security/AI/policy). Not every
          singleton; the ones worth a look.
        </p>

        {error ? (
          <div className="empty-state py-8 mb-10">
            <p className="page-title mb-2">Could not load blindspots</p>
            <p>{error}</p>
          </div>
        ) : featured.length === 0 ? (
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
                sourceNames={
                  story.coverage_outlets?.map((o) => o.name) ||
                  (story.primary_source ? [story.primary_source] : undefined)
                }
                href={`/story/${story.id}`}
              />
            ))}
          </div>
        )}

        {!error && (
          <>
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
          </>
        )}
      </section>
    </div>
  )
}
