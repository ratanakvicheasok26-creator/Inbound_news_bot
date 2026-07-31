import { isValidImageUrl } from "./story-images"
import { resolveOgImage } from "./og-image"
import type { Story } from "./types"

export type PriorityOptions = {
  /** Max stories to attempt server-side OG resolution for. */
  resolveLimit?: number
  /** Concurrent OG fetches. */
  concurrency?: number
}

/**
 * Resolve missing story images server-side (results cached by Next fetch for
 * 24h via `resolveOgImage`), then stable-sort so stories with a usable image
 * surface first. Only import from server components / server modules.
 */
export async function prioritizeStoriesWithImages(
  stories: Story[],
  options: PriorityOptions = {},
): Promise<Story[]> {
  const { resolveLimit = 24, concurrency = 6 } = options
  if (stories.length === 0) return stories

  const missing = stories
    .filter((s) => !isValidImageUrl(s.image_url) && isValidImageUrl(s.primary_url))
    .slice(0, resolveLimit)

  let cursor = 0
  async function worker() {
    while (cursor < missing.length) {
      const story = missing[cursor++]
      const image = await resolveOgImage(story.primary_url as string)
      if (isValidImageUrl(image)) story.image_url = image
    }
  }

  const workers = Math.min(Math.max(concurrency, 1), Math.max(missing.length, 1))
  await Promise.all(Array.from({ length: workers }, worker))

  return stories
    .map((story, index) => ({ story, index }))
    .sort((a, b) => {
      const aHas = isValidImageUrl(a.story.image_url) ? 1 : 0
      const bHas = isValidImageUrl(b.story.image_url) ? 1 : 0
      if (aHas !== bHas) return bHas - aHas
      return a.index - b.index
    })
    .map(({ story }) => story)
}
