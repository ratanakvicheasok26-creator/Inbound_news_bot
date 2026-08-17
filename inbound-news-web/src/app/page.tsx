import { getAllStoriesSafe } from "@/lib/posts"
import { prioritizeStoriesWithImages, selectFeedStories } from "@/lib/story-priority"
import { FeaturedEditorialGrid } from "@/components/story/FeaturedEditorialGrid"
import { StoryCard } from "@/components/story/StoryCard"
import { AdBand } from "@/components/ads/AdBand"
import { isMockStoriesEnabled } from "@/lib/mock-stories"
import { pickSponsorFrom } from "@/lib/sponsors"
import { getActiveSponsors } from "@/lib/sponsors-server"
import { LocalizedText } from "@/components/LocalizedText"
import Link from "next/link"

export const revalidate = 60

export default async function HomePage() {
  // Over-fetch then rank so multi-source / imaged stories win the lead slot
  // even when noisier forum items are newer in the raw ingest order.
  const demoMode = isMockStoriesEnabled()
  const { stories, error } = await getAllStoriesSafe(72)
  // Mock data already has images — skip outbound OG fetches (lag + flicker on localhost).
  const prioritized = await prioritizeStoriesWithImages(stories, {
    resolveLimit: demoMode ? 0 : 6,
    concurrency: 3,
  })
  const feed = selectFeedStories(prioritized, 13)
  const { sponsors } = await getActiveSponsors()
  const homeAd = pickSponsorFrom("home", sponsors)
  const feedAd = pickSponsorFrom("homeFeed", sponsors)

  const leadStory = feed[0] || null
  const secondaryStories = feed.slice(1, 4)
  const feedRest = feed.slice(4)

  if (!leadStory) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="empty-state max-w-lg mx-auto">
          <p className="page-title mb-3">
            <LocalizedText k="home.noStoriesTitle" />
          </p>
          <p className="text-[var(--text-secondary)] normal-case tracking-normal">
            <LocalizedText k="home.loadError" />
            {error ? `: ${error}` : ""}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {demoMode && (
        <div className="border-b border-[var(--border)] bg-[var(--surface-alt)]">
          <div className="container mx-auto px-4 sm:px-6 py-2.5 text-[12px] text-[var(--text-secondary)]">
            <strong className="text-[var(--text-primary)]">
              <LocalizedText k="home.demoData" />
            </strong>
            {" — "}
            <LocalizedText k="home.demoBody" />
          </div>
        </div>
      )}

      {/* Centered Hero Section from Stitch design */}
      <section className="pt-10 pb-8 md:pt-16 md:pb-12 text-center">
        <div className="container max-w-3xl mx-auto px-4 sm:px-6">
          <div className="inline-flex items-center px-3.5 py-1 rounded-full bg-[var(--red-subtle-bg)] text-[var(--accent)] text-xs font-bold tracking-wider mb-5">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] mr-2 animate-pulse" aria-hidden="true" />
            <LocalizedText k="home.heroTag" />
          </div>
          <h1 className="font-display-modern text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[var(--text-primary)] mb-5 leading-[1.08]">
            <LocalizedText k="home.heroTitle" />
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-[var(--text-secondary)] leading-relaxed max-w-2xl mx-auto">
            <LocalizedText k="home.heroSubtitle" />
          </p>
        </div>
      </section>

      {/* Latest Stories Editorial Grid Section */}
      <section className="container mx-auto px-4 sm:px-6 pb-16">
        <div className="flex items-center justify-between mb-8 pb-3 border-b border-[var(--border)]">
          <h2 className="text-2xl sm:text-3xl font-bold font-display-modern tracking-tight text-[var(--text-primary)] flex items-center">
            <span className="w-2 h-7 sm:h-8 bg-[var(--accent)] mr-3.5 rounded-full" aria-hidden="true" />
            <LocalizedText k="home.latest" />
          </h2>
          <Link
            href="/search"
            className="text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors flex items-center group"
          >
            <LocalizedText k="search.searchAll" />
            <svg
              className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </Link>
        </div>

        {/* Featured Editorial Grid (7 cols Lead + 5 cols Stacked) */}
        <FeaturedEditorialGrid
          leadStory={leadStory}
          secondaryStories={secondaryStories}
        />

        {homeAd && (
          <div className="my-10 sm:my-14">
            <AdBand placement="home" creative={homeAd} sponsors={sponsors} />
          </div>
        )}

        {/* Remaining Stories Grid */}
        {feedRest.length > 0 && (
          <div className="mt-12 sm:mt-16 pt-10 border-t border-[var(--border)]">
            <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {feedRest.slice(0, 6).map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
              {feedRest.length > 6 && (
                <div className="col-span-full min-w-0">
                  {feedAd && (
                    <AdBand placement="homeFeed" flush creative={feedAd} sponsors={sponsors} />
                  )}
                </div>
              )}
              {feedRest.slice(6).map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
