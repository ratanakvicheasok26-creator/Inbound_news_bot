import { getAllStories, getStoryStats } from "@/lib/posts"
import { LeadStoryCard } from "@/components/story/LeadStoryCard"
import { SignalSidebar } from "@/components/story/SignalSidebar"
import { StoryRow } from "@/components/story/StoryRow"
import { BlindspotCard } from "@/components/story/BlindspotCard"
import { StatsStrip } from "@/components/story/StatsStrip"
import { TrendingStrip } from "@/components/story/TrendingStrip"

export default async function HomePage() {
  const [stories, stats] = await Promise.all([getAllStories(), getStoryStats()])

  const leadStory = stories[0] || null
  const signalStories = stories.slice(1, 6)
  const trendingStories = stories.slice(0, 8)
  const latestStories = stories.slice(0, 15)
  const blindspotStories = [...stories]
    .filter((s) => (s.source_count ?? 0) <= 3)
    .sort((a, b) => (a.source_count ?? 0) - (b.source_count ?? 0))
    .slice(0, 2)

  if (!leadStory) {
    return (
      <div className="container">
        <div className="empty-state">
          <p className="text-[32px] font-extrabold tracking-tight mb-2">THE WIRE IS QUIET</p>
          <p>No dispatches yet. Stories will appear here as they come in.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      {/* LEAD STORY + SIGNAL SIDEBAR */}
      <section className="grid gap-12 py-10 border-b-2 border-[var(--text-primary)] md:grid-cols-[2fr_1fr]">
        <LeadStoryCard story={leadStory} />
        <SignalSidebar stories={signalStories} />
      </section>

      {/* TRENDING STRIP */}
      <section className="py-10 border-b border-[var(--border)]">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-number mr-3">01</span>
            Trending
          </h2>
        </div>
        <TrendingStrip stories={trendingStories} />
      </section>

      {/* BLINDSPOT SECTION */}
      <section className="py-10 border-b border-[var(--border)]">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-number mr-3">02</span>
            Blindspot
          </h2>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            Underreported stories
          </span>
        </div>
        {blindspotStories.length === 0 ? (
          <p className="font-mono text-[12px] text-[var(--text-secondary)]">
            No underreported clusters yet.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {blindspotStories.map((story) => (
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
      </section>

      {/* LATEST COVERAGE */}
      <section className="py-10 border-b border-[var(--border)]">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-number mr-3">03</span>
            Latest Coverage
          </h2>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            {latestStories.length} stories
          </span>
        </div>
        <div>
          {latestStories.map((story) => (
            <StoryRow key={story.id} story={story} />
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="py-10 border-b-2 border-[var(--text-primary)]">
        <StatsStrip stats={stats} />
      </section>
    </div>
  )
}
