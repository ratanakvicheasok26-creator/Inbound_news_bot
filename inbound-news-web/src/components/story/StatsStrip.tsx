export function StatsStrip({
  stats,
}: {
  stats: { storyCount: number; sourceCount: number; categoryCount: number }
}) {
  const items = [
    { value: stats.storyCount.toLocaleString(), label: "Stories clustered" },
    { value: stats.sourceCount.toLocaleString(), label: "Sources in network" },
    { value: stats.categoryCount.toLocaleString(), label: "Topics tracked" },
    { value: "Free", label: "Always free to read" },
  ]

  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] px-5 py-4"
        >
          <div className="font-display text-[28px] md:text-[32px] font-semibold tabular-nums tracking-tight">
            {item.value}
          </div>
          <div className="mt-1 meta-text">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
