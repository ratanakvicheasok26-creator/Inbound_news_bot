import { getAllStories } from "@/lib/posts"
import { formatDistanceToNow } from "@/lib/utils"

export async function Ticker() {
  const stories = await getAllStories()
  const items = stories.slice(0, 10)
  if (items.length === 0) return null

  const duplicated = [...items, ...items]

  return (
    <div className="ticker">
      <div className="ticker-track">
        {duplicated.map((story, i) => (
          <span
            key={`${story.id}-${i}`}
            className={`ticker-item ${story.category === "cybersecurity" ? "breaking" : ""}`}
          >
            {story.title}
            <span className="text-[var(--accent)] text-[10px] ml-1">
              {formatDistanceToNow(story.created_at)}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
