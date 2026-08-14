import { getAllStoriesSafe } from "@/lib/posts"
import { prioritizeStoriesWithImages, selectFeedStories } from "@/lib/story-priority"
import { LeadStoryCard } from "@/components/story/LeadStoryCard"
import { StoryCard } from "@/components/story/StoryCard"
import { isMockStoriesEnabled } from "@/lib/mock-stories"
import Link from "next/link"

export const revalidate = 60

export default async function HomePage() {
  // Over-fetch then rank so multi-source / imaged stories win the lead slot
  // even when noisier forum items are newer in the raw ingest order.
  const { stories, error } = await getAllStoriesSafe(72)
  // Prefer stored images; only resolve a few missing OGs so home stays fast.
  const prioritized = await prioritizeStoriesWithImages(stories, {
    resolveLimit: 6,
    concurrency: 3,
  })
  const feed = selectFeedStories(prioritized, 13)

  const leadStory = feed[0] || null
  const latestStories = feed.slice(1)
  const demoMode = isMockStoriesEnabled()

  if (!leadStory) {
    return (
      <div className="container py-20">
        <div className="empty-state max-w-lg mx-auto">
          <p className="page-title mb-3">No stories yet</p>
          <p className="text-[var(--text-secondary)] normal-case tracking-normal">
            {error
              ? `Could not load stories: ${error}. Check Supabase env vars and migrations.`
              : "Run website ingest to cluster sources and start decoding coverage."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {demoMode && (
        <div className="border-b border-[var(--border)] bg-[var(--surface-alt)]">
          <div className="container py-2.5 text-[12px] text-[var(--text-secondary)]">
            <strong className="text-[var(--text-primary)]">Demo data</strong>
            {" — "}
            Supabase is not configured locally. Showing mock stories so you can review coverage,
            Blindspot, Compare, and Local Lens. Real ingest replaces this later.
          </div>
        </div>
      )}
      {/* Hero — brand positioning + lead story */}
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="container pt-8 pb-10 md:pt-12 md:pb-14">
          <div className="mb-8 md:mb-10 animate-[riseIn_350ms_ease-out]">
            <p className="chip mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              Inbound Reports
            </p>
            <h1 className="font-display-modern text-[clamp(32px,5vw,56px)] font-bold leading-[1.04] tracking-[-0.025em]">
              Decode the Tech.
            </h1>
            <p className="mt-4 max-w-[46ch] text-[15px] md:text-[17px] leading-[1.6] text-[var(--text-secondary)]">
              Technology coverage from Phnom Penh — who covered it, how they framed it, and
              what&apos;s undercovered. Compare outlets, cut jargon, Local Lens for Cambodia.
            </p>
          </div>

          <LeadStoryCard story={leadStory} />
        </div>
      </section>

      {/* Latest stories — equal 3-column grid */}
      <section className="container pt-14 pb-12 md:pt-20 md:pb-16">
        <div className="section-header">
          <h2 className="section-title flex items-center gap-2.5">
            <span className="inline-block h-4 w-1 rounded-full bg-[var(--accent)]" aria-hidden="true" />
            Latest stories
          </h2>
          <Link
            href="/search"
            className="meta-text hover:text-[var(--accent)] transition-colors"
          >
            Search all
          </Link>
        </div>

        <div className="grid gap-5 gap-y-8 sm:grid-cols-2 sm:gap-6 sm:gap-y-10 lg:grid-cols-3">
          {latestStories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </section>

      {/* Literacy tools */}
      <section className="border-t border-[var(--border)]">
        <div className="container py-8 md:py-10 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-[var(--text-secondary)]">
          <Link href="/brief" className="hover:text-[var(--accent)] transition-colors">
            Daily Brief
          </Link>
          <Link href="/glossary" className="hover:text-[var(--accent)] transition-colors">
            Glossary
          </Link>
          <Link href="/legal/methodology" className="hover:text-[var(--accent)] transition-colors">
            Methodology
          </Link>
          <Link href="/about" className="hover:text-[var(--accent)] transition-colors">
            About
          </Link>
          <span>Coverage map · Compare · Blindspot · ELI5 / Standard / Deep</span>
        </div>
      </section>
    </div>
  )
}
