import Link from "next/link"
import { getAllStories } from "@/lib/posts"
import { formatDistanceToNow } from "@/lib/utils"

export async function Ticker() {
  const stories = await getAllStories()
  const items = stories.slice(0, 4)
  if (items.length === 0) return null

  return (
    <div className="ticker">
      <div className="ticker-track">
        <span className="ticker-label">Latest Stories</span>
        {items.map((story) => (
          <Link
            key={story.id}
            href={`/story/${story.id}`}
            className={`ticker-item ${story.category === "cybersecurity" ? "breaking" : ""}`}
          >
            <span className="truncate">{story.title}</span>
            <span className="text-[var(--accent)] text-[10px] shrink-0">
              {formatDistanceToNow(story.created_at)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
