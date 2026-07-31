import { getAllStoriesSafe } from "@/lib/posts"
import { prioritizeStoriesWithImages } from "@/lib/story-priority"
import { LeadStoryCard } from "@/components/story/LeadStoryCard"
import { StoryCard } from "@/components/story/StoryCard"
import Link from "next/link"

export default async function HomePage() {
  const { stories, error } = await getAllStoriesSafe(24)
  const storiesWithMedia = await prioritizeStoriesWithImages(stories)

  const leadStory = storiesWithMedia[0] || null
  const latestStories = storiesWithMedia.slice(1, 13)

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
      {/* Brand + lead hero */}
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="container pt-8 pb-10 md:pt-10 md:pb-12">
          <div className="mb-8 md:mb-10 animate-[riseIn_350ms_ease-out]">
            <p className="font-display text-[clamp(26px,3.6vw,38px)] font-semibold leading-none tracking-[-0.03em] text-[var(--text-primary)]">
              Inbound Reports
            </p>
            <p className="mt-2 text-[14px] md:text-[15px] text-[var(--text-secondary)] max-w-[42ch]">
              Decode the Tech. Aggregated coverage from Phnom Penh —
              clustered sources, cut jargon, Local Lens.
            </p>
          </div>

          <LeadStoryCard story={leadStory} />
        </div>
      </section>

      {/* Latest stories — equal 3-column grid */}
      <section className="container pt-10 pb-12 md:pt-14 md:pb-16">
        <div className="section-header">
          <h2 className="section-title">Latest stories</h2>
          <Link
            href="/search"
            className="meta-text hover:text-[var(--accent)] transition-colors"
          >
            Search all
          </Link>
        </div>

        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3">
          {latestStories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </section>

      {/* Literacy tools */}
      <section className="border-t border-[var(--border)]">
        <div className="container py-8 md:py-10 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-[var(--text-secondary)]">
          <Link href="/glossary" className="hover:text-[var(--accent)] transition-colors">
            Glossary
          </Link>
          <Link href="/legal/methodology" className="hover:text-[var(--accent)] transition-colors">
            Methodology
          </Link>
          <Link href="/about" className="hover:text-[var(--accent)] transition-colors">
            About
          </Link>
          <span>ELI5 · Standard · Deep on every story</span>
        </div>
      </section>
    </div>
  )
}
