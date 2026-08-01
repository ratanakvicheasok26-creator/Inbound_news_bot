import { notFound } from "next/navigation"
import { getStoryById } from "@/lib/posts"
import { StoryContent } from "@/components/story/StoryContent"

export const revalidate = 300

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  // `slug` route segment is the story UUID (no slug column on stories).
  const { slug } = await params
  const story = await getStoryById(slug)

  if (!story) {
    notFound()
  }

  return <StoryContent story={story} />
}
