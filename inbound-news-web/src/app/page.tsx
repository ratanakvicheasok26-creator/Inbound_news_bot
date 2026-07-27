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

  if (!leadStory) {
    return (
      <div className="container">
        <div className="empty-state">
          <p className="font-serif text-[24px] mb-2">The wire is quiet</p>
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
      <section className="py-8 border-b border-[var(--border)]">
        <div className="section-header">
          <h2 className="section-title">Trending</h2>
        </div>
        <TrendingStrip stories={trendingStories} />
      </section>

      {/* BLINDSPOT SECTION */}
      <section className="py-10 border-b border-[var(--border)]">
        <div className="section-header">
          <h2 className="section-title">&#9888; Blindspot</h2>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            Underreported stories
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <BlindspotCard
            title="Cambodia's new data privacy law takes effect with unclear enforcement"
            summary="Only 2 sources covering this — both from regional tech press"
            sourceCount={2}
            sourceNames={["Tech in Asia", "Rest of World"]}
          />
          <BlindspotCard
            title="Southeast Asian startups shifting from growth to profitability ahead of global peers"
            summary="Mainstream media has not picked this up"
            sourceCount={3}
            sourceNames={["e27", "KrASIA"]}
          />
        </div>
      </section>

      {/* LATEST COVERAGE */}
      <section className="py-10 border-b border-[var(--border)]">
        <div className="section-header">
          <h2 className="section-title">Latest Coverage</h2>
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
