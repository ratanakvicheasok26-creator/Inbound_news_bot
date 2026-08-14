import Link from "next/link"

interface BlindspotCardProps {
  title: string
  summary?: string
  sourceCount: number
  sourceNames?: string[]
  /** e.g. "1 outlet · Research · 12h ago" */
  why?: string
  /** true blindspot vs thin/skewed */
  variant?: "blindspot" | "thin"
  href?: string
}

export function BlindspotCard({
  title,
  summary,
  sourceCount,
  sourceNames = [],
  why,
  variant = "blindspot",
  href,
}: BlindspotCardProps) {
  const isThin = variant === "thin"
  const body = (
    <>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="dna-tag dna-tag-hype">
          {isThin ? "Thin coverage" : "Blindspot"}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--red-subtle-text)] font-bold">
          {isThin ? "Skewed" : "Underreported"}
        </span>
      </div>
      <h3 className="story-title">{title}</h3>
      {why ? (
        <p className="mt-1.5 font-mono text-[11px] text-[var(--text-secondary)] tracking-wide">
          {why}
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-[var(--text-secondary)] line-clamp-2">
          Only {sourceCount} source{sourceCount !== 1 ? "s" : ""} covering this
          {sourceNames.length > 0 && (
            <span> — {sourceNames.join(", ")}</span>
          )}
        </p>
      )}
      {summary && (
        <p className="mt-2 text-[13px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
          {summary}
        </p>
      )}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="blindspot-card block hover:border-[var(--accent)] transition-colors"
      >
        {body}
      </Link>
    )
  }

  return <div className="blindspot-card">{body}</div>
}
