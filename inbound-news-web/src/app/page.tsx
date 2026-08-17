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
  const demoMode = isMockStoriesEnabled()
  const { stories, error } = await getAllStoriesSafe(72)
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
      <div className="max-w-[1400px] mx-auto px-6 py-20">
        <div className="empty-state max-w-lg mx-auto text-center">
          <p className="text-2xl font-bold text-white mb-3">
            <LocalizedText k="home.noStoriesTitle" />
          </p>
          <p className="text-neutral-400 normal-case tracking-normal">
            <LocalizedText k="home.loadError" />
            {error ? `: ${error}` : ""}
          </p>
        </div>
      </div>
    )
  }

  return (
    <main className="flex-grow min-h-screen">
      {demoMode && (
        <div className="border-b border-neutral-800 bg-neutral-900/60">
          <div className="max-w-[1400px] mx-auto px-6 py-2.5 text-xs text-neutral-400">
            <strong className="text-white">
              <LocalizedText k="home.demoData" />
            </strong>
            {" — "}
            <LocalizedText k="home.demoBody" />
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-6 py-16">
        {/* Header Hero Section */}
        <section className="max-w-2xl pb-8 mx-auto text-center mb-16">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#3a1a20] text-[#FF0030] text-xs font-bold tracking-wider mb-6 mx-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF0030] mr-2 animate-pulse" aria-hidden="true" />
            <LocalizedText k="home.heroTag" />
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white mb-6 shadow-glow-red font-display-modern">
            <LocalizedText k="home.heroTitle" />
          </h1>

          <p className="text-xl text-neutral-400 leading-relaxed">
            <LocalizedText k="home.heroSubtitle" />
          </p>
        </section>

        {/* Latest Editorial Grid Section */}
        <section>
          <div className="flex items-center justify-between mb-8 pb-2">
            <h2 className="text-3xl font-bold tracking-tight text-white flex items-center font-display-modern">
              <span className="w-2 h-8 bg-[#FF0030] mr-4 rounded-full" aria-hidden="true" />
              <LocalizedText k="home.latest" />
            </h2>
            <Link
              href="/search"
              className="text-sm font-medium text-neutral-400 hover:text-white transition-colors flex items-center group"
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

          {/* Featured Editorial Grid (7 cols Lead + 5 cols 3 Stacked) */}
          <FeaturedEditorialGrid
            leadStory={leadStory}
            secondaryStories={secondaryStories}
          />

          {homeAd && (
            <div className="my-12">
              <AdBand placement="home" creative={homeAd} sponsors={sponsors} />
            </div>
          )}

          {/* Remaining Stories Grid */}
          {feedRest.length > 0 && (
            <div className="mt-16 pt-12 border-t border-neutral-800">
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
    </main>
  )
}
