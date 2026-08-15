import { LocalizedText } from "@/components/LocalizedText"

interface HypeRealityBarProps {
  score: number
  sources?: { name: string; score: number }[]
  size?: "sm" | "md" | "lg"
  showLabels?: boolean
  className?: string
}

export function HypeRealityBar({
  score,
  sources = [],
  size = "md",
  showLabels = false,
  className = "",
}: HypeRealityBarProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const height = size === "sm" ? "h-[4px]" : size === "lg" ? "h-[8px]" : "h-[6px]"

  return (
    <div className={className}>
      <div className={`relative ${height} bg-[var(--surface-alt)] rounded-full overflow-hidden`}>
        <div
          className="h-full bg-[var(--accent)] rounded-full"
          style={{ width: `${clamped}%` }}
          title={`Coverage: ${clamped}/100`}
        />
        {sources.map((src, i) => {
          const srcClamped = Math.max(0, Math.min(100, src.score))
          return (
            <div
              key={`${src.name}-${i}`}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[7px] h-[7px] rounded-full border border-[var(--border)] bg-[var(--surface)]"
              style={{ left: `${srcClamped}%` }}
              title={`${src.name}: ${srcClamped}/100`}
            />
          )
        })}
      </div>
      {showLabels && (
        <div className="flex justify-between mt-1.5">
          <span className="meta-text"><LocalizedText k="coverage.quiet" /></span>
          <span className="meta-text"><LocalizedText k="coverage.wide" /></span>
        </div>
      )}
      {sources.length > 0 && showLabels && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {sources.map((src, i) => (
            <span key={`${src.name}-label-${i}`} className="meta-text normal-case tracking-normal font-medium">
              {src.name} <span className="tabular-nums">{src.score}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
