import { getAllStoriesSafe } from "@/lib/posts"
import { prioritizeStoriesWithImages, selectFeedStories } from "@/lib/story-priority"
import { LeadStoryCard } from "@/components/story/LeadStoryCard"
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
  const latestStories = feed.slice(1)
  const feedTop = latestStories.slice(0, 6)
  const feedRest = latestStories.slice(6)

  if (!leadStory) {
    return (
      <div className="container py-20">
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
    <div>
      {demoMode && (
        <div className="border-b border-[var(--border)] bg-[var(--surface-alt)]">
          <div className="container py-2.5 text-[12px] text-[var(--text-secondary)]">
            <strong className="text-[var(--text-primary)]">
              <LocalizedText k="home.demoData" />
            </strong>
            {" — "}
            <LocalizedText k="home.demoBody" />
          </div>
        </div>
      )}
      {/* Hero — brand positioning + lead story */}
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="container pt-8 pb-10 md:pt-12 md:pb-14">
          <div className="mb-8 md:mb-10">
            <p className="chip mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              <LocalizedText k="home.heroTag" />
            </p>
            <h1 className="font-display-modern text-[clamp(32px,5vw,56px)] font-bold leading-[1.04] tracking-[-0.025em]">
              <LocalizedText k="home.heroTitle" />
            </h1>
            <p className="mt-4 max-w-[46ch] text-[15px] md:text-[17px] leading-[1.6] text-[var(--text-secondary)]">
              <LocalizedText k="home.heroSubtitle" />
            </p>
          </div>

          <LeadStoryCard story={leadStory} />
        </div>
      </section>

      {homeAd && <AdBand placement="home" creative={homeAd} sponsors={sponsors} />}

      {/* Latest stories — equal 3-column grid */}
      <section className="container pt-14 pb-12 md:pt-20 md:pb-16">
        <div className="section-header">
          <h2 className="section-title flex items-center gap-2.5">
            <span className="inline-block h-4 w-1 rounded-full bg-[var(--accent)]" aria-hidden="true" />
            <LocalizedText k="home.latest" />
          </h2>
          <Link
            href="/search"
            className="meta-text hover:text-[var(--accent)] transition-colors"
          >
            <LocalizedText k="search.searchAll" />
          </Link>
        </div>

        <div className="grid gap-5 gap-y-8 sm:grid-cols-2 sm:gap-6 sm:gap-y-10 lg:grid-cols-3">
          {feedTop.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
          {feedRest.length > 0 && (
            <div className="col-span-full min-w-0">
              {feedAd && (
                <AdBand placement="homeFeed" flush creative={feedAd} sponsors={sponsors} />
              )}
            </div>
          )}
          {feedRest.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </section>
    </div>
  )
}
