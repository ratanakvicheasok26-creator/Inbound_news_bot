import Link from "next/link"
import { getAllStories } from "@/lib/posts"
import { rankStoriesForFeed } from "@/lib/story-priority"
import { formatDistanceToNow } from "@/lib/utils"

export async function Ticker() {
  const stories = await getAllStories(16)
  const items = rankStoriesForFeed(stories).slice(0, 4)
  if (items.length === 0) return null

  return (
    <div className="ticker">
      <div className="ticker-track">
        <span className="ticker-label">Latest</span>
        {items.map((story) => (
          <Link
            key={story.id}
            href={`/story/${story.id}`}
            className={`ticker-item ${story.category === "cybersecurity" ? "breaking" : ""}`}
          >
            <span className="truncate max-w-[220px] md:max-w-[280px]">{story.title}</span>
            <span className="text-[11px] shrink-0 opacity-70">
              {formatDistanceToNow(story.created_at)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
