import Link from "next/link"
import { notFound } from "next/navigation"
import { getStoriesForBrief, phnomPenhDayBounds, todayPhnomPenhYmd } from "@/lib/posts"
import { prioritizeStoriesWithImages, selectFeedStories } from "@/lib/story-priority"
import { StoryRow } from "@/components/story/StoryRow"

export const revalidate = 60

function shiftYmd(dateYmd: string, days: number): string {
  const start = new Date(`${dateYmd}T12:00:00+07:00`)
  start.setTime(start.getTime() + days * 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(start)
}

function formatBriefHeading(dateYmd: string): string {
  const d = new Date(`${dateYmd}T12:00:00+07:00`)
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Phnom_Penh",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d)
}

export default async function BriefDatePage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  if (!phnomPenhDayBounds(date)) {
    notFound()
  }

  const today = todayPhnomPenhYmd()
  const { stories, error } = await getStoriesForBrief(date)
  const prioritized = await prioritizeStoriesWithImages(stories)
  const ranked = selectFeedStories(prioritized, 24)
  const isToday = date === today
  const prev = shiftYmd(date, -1)
  const next = shiftYmd(date, 1)
  const canGoNext = next <= today

  return (
    <div className="container pb-16">
      <header className="pt-10 pb-8 border-b border-[var(--border)]">
        <p className="chip mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          Daily Brief
        </p>
        <h1 className="font-display text-[clamp(28px,4.5vw,44px)] font-semibold leading-[1.12] tracking-[-0.025em]">
          {isToday ? "Today’s Brief" : formatBriefHeading(date)}
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.6] text-[var(--text-secondary)]">
          What Telegram teases — open each story for ELI5/Standard/Deep reading,
          multi-source coverage, and Local Lens for Cambodia.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-[13px] font-semibold">
          <Link href={`/brief/${prev}`} className="text-[var(--text-secondary)] hover:text-[var(--accent)]">
            ← Previous day
          </Link>
          {!isToday && (
            <Link href="/brief" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
              Jump to today
            </Link>
          )}
          {canGoNext && (
            <Link href={`/brief/${next}`} className="text-[var(--text-secondary)] hover:text-[var(--accent)]">
              Next day →
            </Link>
          )}
        </div>
      </header>

      {error && ranked.length === 0 ? (
        <div className="empty-state max-w-lg mx-auto mt-12">
          <p className="page-title mb-3">Brief unavailable</p>
          <p className="text-[var(--text-secondary)] normal-case tracking-normal">{error}</p>
        </div>
      ) : ranked.length === 0 ? (
        <div className="empty-state max-w-lg mx-auto mt-12">
          <p className="page-title mb-3">No stories for this day</p>
          <p className="text-[var(--text-secondary)] normal-case tracking-normal">
            Check back after the next digest, or browse the{" "}
            <Link href="/" className="text-[var(--accent)]">
              latest feed
            </Link>
            .
          </p>
        </div>
      ) : (
        <section className="pt-8">
          <div className="flex flex-col gap-1">
            {ranked.map((story) => (
              <StoryRow key={story.id} story={story} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
