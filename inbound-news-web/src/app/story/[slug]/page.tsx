import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getStoryById } from "@/lib/posts"
import { StoryContent } from "@/components/story/StoryContent"
import {
  isUsefulSummary,
  resolveStoryBody,
  resolveStoryDek,
  redactPremiumStory,
} from "@/lib/story-body"
import { pickSponsorFrom } from "@/lib/sponsors"
import { getActiveSponsors } from "@/lib/sponsors-server"

export const revalidate = 300

type StoryPageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: StoryPageProps): Promise<Metadata> {
  const { slug } = await params
  const story = await getStoryById(slug)
  if (!story) {
    return { title: "Story not found — Inbound Reports" }
  }

  const body = resolveStoryBody(story)
  const isPremium = story.premium === true
  const description = isPremium
    ? resolveStoryDek(body, 170) ||
      `Premium story · Clustered tech coverage · ${story.source_count || 1} source(s)`
    : resolveStoryDek(isUsefulSummary(body) ? body : story.summary_en, 160) ||
      `Clustered tech coverage · ${story.source_count || 1} source(s)`

  return {
    title: `${story.title} — Inbound Reports`,
    description,
    openGraph: {
      title: story.title,
      description,
      type: "article",
      images: story.image_url ? [{ url: story.image_url }] : undefined,
    },
    twitter: {
      card: story.image_url ? "summary_large_image" : "summary",
      title: story.title,
      description,
    },
  }
}

export default async function StoryPage({ params }: StoryPageProps) {
  // `slug` route segment is the story UUID (no slug column on stories).
  const { slug } = await params
  const story = await getStoryById(slug)

  if (!story) {
    notFound()
  }

  const isPremium = story.premium === true
  const { content, teaser } = isPremium
    ? redactPremiumStory(story)
    : { content: story, teaser: null }

  const { sponsors } = await getActiveSponsors()
  const sponsorCreative = pickSponsorFrom("story", sponsors)

  return (
    <StoryContent
      story={content}
      premiumLocked={isPremium}
      premiumTeaser={teaser}
      sponsorCreative={sponsorCreative}
      sponsors={sponsors}
    />
  )
}
