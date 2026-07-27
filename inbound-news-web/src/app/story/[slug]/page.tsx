import { notFound } from "next/navigation"
import { getStoryBySlug } from "@/lib/posts"
import { StoryContent } from "@/components/story/StoryContent"

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const story = await getStoryBySlug(slug)

  if (!story) {
    notFound()
  }

  return <StoryContent story={story} />
}
