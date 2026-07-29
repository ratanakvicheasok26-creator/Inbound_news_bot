import type { Article } from "@/lib/types"

interface TimelineNode {
  date: string
  label: string
  phase: "break" | "clarification" | "pushback" | "analysis"
  sourceCount: number
}

const phaseColors: Record<string, string> = {
  break: "var(--red-breaking)",
  clarification: "var(--accent)",
  pushback: "var(--text-secondary)",
  analysis: "var(--text-primary)",
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)
}

function formatRelativeDay(date: Date, origin: Date): string {
  const d = Math.round(daysBetween(origin, date))
  if (d === 0) return "Today"
  if (d === 1) return "Day 2"
  if (d < 7) return `Day ${d + 1}`
  if (d < 30) return `Week ${Math.ceil(d / 7)}`
  return `Month ${Math.ceil(d / 30)}`
}

export function deriveTimelineNodes(articles: Article[]): TimelineNode[] {
  const withDates = articles
    .filter((a) => a.published_at)
    .map((a) => ({ ...a, date: new Date(a.published_at!) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  if (withDates.length === 0) {
    return [
      { date: "Now", label: "Latest", phase: "analysis", sourceCount: 0 },
    ]
  }

  const origin = withDates[0].date

  if (withDates.length === 1) {
    return [
      { date: formatRelativeDay(withDates[0].date, origin), label: "Initial report", phase: "break", sourceCount: 1 },
    ]
  }

  if (withDates.length === 2) {
    const gap = daysBetween(withDates[0].date, withDates[1].date)
    if (gap < 2) {
      return [
        { date: formatRelativeDay(withDates[0].date, origin), label: "Initial report", phase: "break", sourceCount: 1 },
        { date: formatRelativeDay(withDates[1].date, origin), label: "Follow-up", phase: "clarification", sourceCount: 1 },
      ]
    }
    return [
      { date: formatRelativeDay(withDates[0].date, origin), label: "Initial report", phase: "break", sourceCount: 1 },
      { date: formatRelativeDay(withDates[1].date, origin), label: "Coverage expands", phase: "analysis", sourceCount: 1 },
    ]
  }

  const nodes: TimelineNode[] = []
  const bucketCount = Math.min(4, withDates.length)

  const bucketSize = Math.ceil(withDates.length / bucketCount)
  const buckets: typeof withDates[] = []
  for (let i = 0; i < withDates.length; i += bucketSize) {
    buckets.push(withDates.slice(i, i + bucketSize))
  }

  const phaseLabels: Array<{ label: string; phase: TimelineNode["phase"] }> = [
    { label: "Initial report", phase: "break" },
    { label: "Clarification", phase: "clarification" },
    { label: "Coverage expands", phase: "pushback" },
    { label: "Analysis", phase: "analysis" },
  ]

  buckets.forEach((bucket, i) => {
    const ref = phaseLabels[i] || phaseLabels[phaseLabels.length - 1]
    const earliest = bucket[0]
    nodes.push({
      date: formatRelativeDay(earliest.date, origin),
      label: ref.label,
      phase: ref.phase,
      sourceCount: bucket.length,
    })
  })

  return nodes
}

interface StoryTimelineProps {
  nodes: TimelineNode[]
}

export function StoryTimeline({ nodes }: StoryTimelineProps) {
  if (nodes.length === 0) return null

  return (
    <div className="py-6">
      <div className="section-header">
        <h2 className="section-title">Story Evolution</h2>
      </div>
      <div className="relative">
        <div className="absolute top-[7px] left-0 right-0 h-[2px] bg-[var(--text-primary)]" />

        <div className="relative flex justify-between gap-2 overflow-x-auto">
          {nodes.map((node, i) => (
            <div key={i} className="flex flex-col items-center text-center min-w-[120px] shrink-0" style={{ width: `${100 / nodes.length}%` }}>
              <div
                className="w-3.5 h-3.5 rounded-full border-2 mb-2 relative z-10"
                style={{
                  borderColor: phaseColors[node.phase],
                  backgroundColor: i === 0 ? phaseColors[node.phase] : "var(--bg)",
                }}
              />
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1 font-bold">
                {node.date}
              </span>
              <span className="text-[11px] text-[var(--text-primary)] font-bold leading-tight">
                {node.label}
              </span>
              {node.sourceCount > 1 && (
                <span className="font-mono text-[10px] text-[var(--text-secondary)] mt-0.5 font-medium">
                  {node.sourceCount} sources
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
