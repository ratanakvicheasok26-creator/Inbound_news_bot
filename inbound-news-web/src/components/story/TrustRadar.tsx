interface TrustAxis {
  label: string
  score: number
  maxScore?: number
}

interface TrustRadarProps {
  score: number
  axes?: TrustAxis[]
  maxScore?: number
  size?: "sm" | "md" | "lg"
}

const AXIS_LABELS: Record<string, string> = {
  primary_sourcing: "Primary Sources",
  technical_accuracy: "Accuracy",
  originality: "Originality",
  corrections: "Corrections",
  funding_disclosure: "Funding",
}

export function TrustRadar({ score, axes, maxScore = 5, size = "sm" }: TrustRadarProps) {
  const dotSize = size === "sm" ? "w-[6px] h-[6px]" : size === "md" ? "w-[8px] h-[8px]" : "w-[10px] h-[10px]"

  if (axes && axes.length > 0) {
    return (
      <div className="space-y-2">
        {axes.map((axis) => {
          const filled = Math.round(axis.score)
          const axisMax = axis.maxScore || maxScore
          return (
            <div key={axis.label} className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-[var(--text-secondary)] w-[90px] shrink-0 text-right uppercase tracking-wider">
                {AXIS_LABELS[axis.label] || axis.label}
              </span>
              <div className="flex gap-[3px]">
                {Array.from({ length: axisMax }).map((_, i) => (
                  <div
                    key={i}
                    className={`${dotSize} rounded-full ${
                      i < filled
                        ? "bg-[var(--text-primary)]"
                        : filled <= 2
                          ? "border border-[var(--red-critical)] bg-transparent"
                          : "border border-[var(--text-secondary)] bg-transparent"
                    }`}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="trust-radar">
      {Array.from({ length: maxScore }).map((_, i) => {
        const filled = i < score
        const critical = !filled && score <= 2
        return (
          <div
            key={i}
            className={`${dotSize} rounded-full trust-radar-dot ${
              filled
                ? "bg-[var(--text-primary)]"
                : critical
                  ? "critical"
                  : "hollow"
            }`}
          />
        )
      })}
    </div>
  )
}
