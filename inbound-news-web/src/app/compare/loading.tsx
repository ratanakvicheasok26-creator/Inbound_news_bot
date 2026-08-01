export default function CompareLoading() {
  return (
    <div className="container pb-12 pt-6 animate-pulse">
      <div className="h-4 w-28 bg-[var(--surface-alt)] rounded mb-8" />
      <div className="h-3 w-40 bg-[var(--surface-alt)] rounded mb-4" />
      <div className="h-9 w-64 bg-[var(--surface-alt)] rounded mb-8" />
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div className="h-52 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-5 space-y-3">
          <div className="h-3 w-32 bg-[var(--surface-alt)] rounded" />
          <div className="h-4 w-full bg-[var(--surface-alt)] rounded" />
          <div className="h-4 w-5/6 bg-[var(--surface-alt)] rounded" />
        </div>
        <div className="h-52 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-5 space-y-3">
          <div className="h-3 w-32 bg-[var(--surface-alt)] rounded" />
          <div className="h-4 w-full bg-[var(--surface-alt)] rounded" />
          <div className="h-4 w-5/6 bg-[var(--surface-alt)] rounded" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 w-2/3 bg-[var(--surface-alt)] rounded" />
        <div className="h-3 w-3/4 bg-[var(--surface-alt)] rounded" />
      </div>
    </div>
  )
}
