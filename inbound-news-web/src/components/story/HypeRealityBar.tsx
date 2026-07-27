interface SourceHype {
  name: string
  score: number
}

interface HypeRealityBarProps {
  score: number
  sources?: SourceHype[]
  size?: "sm" | "md" | "lg"
  showLabels?: boolean
  className?: string
}

export function HypeRealityBar({ score, sources = [], size = "md", showLabels = false, className = "" }: HypeRealityBarProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const isHighHype = clamped > 75
  const height = size === "sm" ? "h-[3px]" : size === "lg" ? "h-[6px]" : "h-[4px]"

  return (
    <div className={className}>
      <div className={`relative ${height} bg-gradient-to-r from-[var(--green-substance)] via-[var(--text-secondary)] to-[var(--red-alert)]`}>
        <div
          className={`hype-bar-dot ${isHighHype ? "high-hype" : ""}`}
          style={{ left: `${clamped}%` }}
          title={`Aggregate hype: ${clamped}/100`}
        />
        {sources.map((src, i) => {
          const srcClamped = Math.max(0, Math.min(100, src.score))
          const srcHigh = srcClamped > 75
          return (
            <div
              key={`${src.name}-${i}`}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[6px] h-[6px] rounded-full border border-[var(--text-primary)] bg-[var(--surface)] transition-all hover:w-[10px] hover:h-[10px] ${srcHigh ? "border-[var(--red-alert)]" : ""}`}
              style={{ left: `${srcClamped}%` }}
              title={`${src.name}: ${srcClamped}/100`}
            />
          )
        })}
      </div>
      {showLabels && (
        <div className="hype-bar-labels mt-1">
          <span>Substance</span>
          <span>Hype</span>
        </div>
      )}
      {sources.length > 0 && showLabels && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {sources.map((src, i) => (
            <div key={`${src.name}-label-${i}`} className="flex items-center gap-1.5">
              <span className={`w-[6px] h-[6px] rounded-full border ${src.score > 75 ? "border-[var(--red-alert)]" : "border-[var(--text-primary)]"} bg-[var(--surface)]`} />
              <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                {src.name} <span className="tabular-nums">{src.score}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
