"use client"

export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="container py-16 text-center">
      <p className="page-title mb-3">Something went wrong</p>
      <p className="mb-6 text-[var(--text-secondary)] max-w-md mx-auto">
        {error.message || "Please try again."}
      </p>
      <button type="button" onClick={reset} className="btn-primary">
        Try again
      </button>
    </div>
  )
}
