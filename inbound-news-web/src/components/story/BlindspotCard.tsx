interface BlindspotCardProps {
  title: string
  summary?: string
  sourceCount: number
  sourceNames: string[]
}

export function BlindspotCard({ title, summary, sourceCount, sourceNames }: BlindspotCardProps) {
  return (
    <div className="blindspot-card">
      <div className="flex items-center gap-2 mb-2">
        <span className="dna-tag dna-tag-hype">
          &#9888; Blindspot
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--red-subtle-text)]">
          Underreported
        </span>
      </div>
      <h3 className="font-serif text-[16px] font-semibold leading-snug text-[var(--text-primary)]">
        {title}
      </h3>
      {summary && (
        <p className="mt-1 text-[13px] text-[var(--text-secondary)] line-clamp-2">
          Only {sourceCount} source{sourceCount !== 1 ? "s" : ""} covering this
          {sourceNames.length > 0 && (
            <span className="text-[var(--text-secondary)]"> &mdash; {sourceNames.join(", ")}</span>
          )}
        </p>
      )}
    </div>
  )
}
