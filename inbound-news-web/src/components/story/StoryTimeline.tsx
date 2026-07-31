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
    return [{ date: "Now", label: "Latest", phase: "analysis", sourceCount: 0 }]
  }

  const origin = withDates[0].date

  if (withDates.length === 1) {
    return [
      {
        date: formatRelativeDay(withDates[0].date, origin),
        label: "Initial report",
        phase: "break",
        sourceCount: 1,
      },
    ]
  }

  if (withDates.length === 2) {
    const gap = daysBetween(withDates[0].date, withDates[1].date)
    return [
      {
        date: formatRelativeDay(withDates[0].date, origin),
        label: "Initial report",
        phase: "break",
        sourceCount: 1,
      },
      {
        date: formatRelativeDay(withDates[1].date, origin),
        label: gap < 2 ? "Follow-up" : "Coverage expands",
        phase: gap < 2 ? "clarification" : "analysis",
        sourceCount: 1,
      },
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
    nodes.push({
      date: formatRelativeDay(bucket[0].date, origin),
      label: ref.label,
      phase: ref.phase,
      sourceCount: bucket.length,
    })
  })

  return nodes
}

export function StoryTimeline({ nodes }: { nodes: TimelineNode[] }) {
  if (nodes.length === 0) return null

  return (
    <div className="py-6">
      <div className="section-header">
        <h2 className="section-title">Story timeline</h2>
      </div>
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] px-4 py-5">
        <div className="absolute top-[26px] left-6 right-6 h-px bg-[var(--border)]" />
        <div className="relative flex justify-between gap-2 overflow-x-auto">
          {nodes.map((node, i) => (
            <div
              key={`${node.label}-${i}`}
              className="flex flex-col items-center text-center min-w-[110px] shrink-0"
              style={{ width: `${100 / nodes.length}%` }}
            >
              <div
                className="w-3 h-3 rounded-full border-2 mb-3 relative z-10 bg-[var(--surface)]"
                style={{
                  borderColor: phaseColors[node.phase],
                  backgroundColor: i === 0 ? phaseColors[node.phase] : "var(--surface)",
                }}
              />
              <span className="meta-text mb-1">{node.date}</span>
              <span className="text-[12px] font-semibold leading-tight text-[var(--text-primary)]">
                {node.label}
              </span>
              {node.sourceCount > 1 && (
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">
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
