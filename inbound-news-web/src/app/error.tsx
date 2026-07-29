"use client"

export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="container">
      <div className="empty-state">
        <p className="page-title mb-3">Something went wrong</p>
        <p className="mb-6 normal-case tracking-normal font-sans text-[var(--text-secondary)]">
          {error.message || "The home page failed to load."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center h-[36px] border-2 border-[var(--text-primary)] px-4 font-mono text-[11px] uppercase tracking-[0.06em] font-bold text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-inverted transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
