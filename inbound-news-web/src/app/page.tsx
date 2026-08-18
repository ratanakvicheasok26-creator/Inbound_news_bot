import { getAllStoriesSafe } from "@/lib/posts"
import { prioritizeStoriesWithImages, selectFeedStories } from "@/lib/story-priority"
import { FeaturedEditorialGrid } from "@/components/story/FeaturedEditorialGrid"
import { StoryCard } from "@/components/story/StoryCard"
import { AdBand } from "@/components/ads/AdBand"
import { pickSponsorFrom } from "@/lib/sponsors"
import { getActiveSponsors } from "@/lib/sponsors-server"
import { LocalizedText } from "@/components/LocalizedText"
import Link from "next/link"

export const revalidate = 60

export default async function HomePage() {
  const { stories, error } = await getAllStoriesSafe(72)
  const prioritized = await prioritizeStoriesWithImages(stories, {
    resolveLimit: 0,
    concurrency: 1,
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
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
        <div className="empty-state max-w-lg mx-auto text-center">
          <p className="text-xl sm:text-2xl font-bold text-white mb-3">
            <LocalizedText k="home.noStoriesTitle" />
          </p>
          <p className="text-neutral-400 text-sm sm:text-base normal-case tracking-normal">
            <LocalizedText k="home.loadError" />
            {error ? `: ${error}` : ""}
          </p>
        </div>
      </div>
    )
  }

  return (
    <main className="flex-grow min-h-screen">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        {/* Header Section */}
        <section className="max-w-3xl pb-4 sm:pb-8 mx-auto text-center mb-8 sm:mb-12 md:mb-16">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#ff0033]/10 border border-[#ff0033]/20 text-[var(--accent)] text-[11px] sm:text-xs font-bold tracking-wider mb-4 sm:mb-6 mx-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mr-2" aria-hidden="true" />
            <LocalizedText k="home.heroTag" />
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--text-primary)] mb-4 sm:mb-6 font-sans text-balance">
            <LocalizedText k="home.heroTitle" />
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-[var(--text-secondary)] leading-relaxed max-w-2xl mx-auto">
            <LocalizedText k="home.heroSubtitle" />
          </p>
        </section>

        {/* Latest Editorial Grid Section */}
        <section>
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] flex items-center font-sans">
              <span className="w-1.5 sm:w-2 h-6 sm:h-8 bg-ir-red mr-3 sm:mr-4 rounded-full" aria-hidden="true" />
              <LocalizedText k="home.latest" />
            </h2>
            <Link
              href="/search"
              className="text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center group"
            >
              <LocalizedText k="common.viewAll" />
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </Link>
          </div>

          {/* Featured Editorial Grid (7 cols Lead + 5 cols 3 Stacked) */}
          <FeaturedEditorialGrid
            leadStory={leadStory}
            secondaryStories={secondaryStories}
          />

          {homeAd && (
            <div className="my-8 sm:my-12">
              <AdBand placement="home" creative={homeAd} sponsors={sponsors} />
            </div>
          )}

          {/* Remaining Stories Grid */}
          {feedRest.length > 0 && (
            <div className="mt-12 sm:mt-16 pt-8 sm:pt-12 border-t border-[var(--border)]">
              <div className="grid gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-2 lg:grid-cols-3">
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
    </main>
  )
}
