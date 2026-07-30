import Link from "next/link"

interface BlindspotCardProps {
  title: string
  summary?: string
  sourceCount: number
  sourceNames?: string[]
  href?: string
}

export function BlindspotCard({ title, summary, sourceCount, sourceNames = [], href }: BlindspotCardProps) {
  const body = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <span className="dna-tag dna-tag-hype">
          &#9888; Blindspot
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--red-subtle-text)] font-bold">
          Underreported
        </span>
      </div>
      <h3 className="story-title">
        {title}
      </h3>
      {(summary || sourceCount > 0) && (
        <p className="mt-1 text-[13px] text-[var(--text-secondary)] line-clamp-2">
          Only {sourceCount} source{sourceCount !== 1 ? "s" : ""} covering this
          {sourceNames.length > 0 && (
            <span className="text-[var(--text-secondary)]"> &mdash; {sourceNames.join(", ")}</span>
          )}
        </p>
      )}
    </>
  )

  if (href) {
    return (
      <Link href={href} className="blindspot-card block hover:border-[var(--accent)] transition-colors">
        {body}
      </Link>
    )
  }

  return <div className="blindspot-card">{body}</div>
}
