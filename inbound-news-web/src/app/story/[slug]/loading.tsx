export default function StoryLoading() {
  return (
    <div className="container pb-12 pt-6 animate-pulse">
      <div className="h-4 w-28 bg-[var(--surface-alt)] rounded mb-8" />
      <div className="h-3 w-40 bg-[var(--surface-alt)] rounded mb-4" />
      <div className="h-10 w-3/4 bg-[var(--surface-alt)] rounded mb-3" />
      <div className="h-10 w-1/2 bg-[var(--surface-alt)] rounded mb-10" />
      <div className="grid gap-8 lg:grid-cols-[1.5fr_0.85fr]">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 space-y-3">
          <div className="h-4 w-full bg-[var(--surface-alt)] rounded" />
          <div className="h-4 w-5/6 bg-[var(--surface-alt)] rounded" />
          <div className="h-4 w-4/6 bg-[var(--surface-alt)] rounded" />
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-5 h-36" />
      </div>
    </div>
  )
}
