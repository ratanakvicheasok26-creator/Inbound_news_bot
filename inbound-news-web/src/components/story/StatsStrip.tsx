export function StatsStrip({
  stats,
}: {
  stats: { storyCount: number; sourceCount: number; categoryCount: number }
}) {
  const items = [
    { value: stats.storyCount.toLocaleString(), label: "Stories Filed" },
    { value: stats.sourceCount.toLocaleString(), label: "Sources Tracked" },
    { value: stats.categoryCount.toLocaleString(), label: "Active Desks" },
    { value: "24/7", label: "Wire Coverage" },
  ]

  return (
    <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="border-t-2 border-[var(--text-primary)] pt-4">
          <div className="font-serif text-[28px] font-bold tabular-nums">{item.value}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-secondary)]">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  )
}
