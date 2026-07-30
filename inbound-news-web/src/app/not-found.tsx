import Link from "next/link"

export default function NotFound() {
  return (
    <div className="container">
      <div className="empty-state py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--accent)] font-bold mb-3">
          Inbound Reports
        </p>
        <p className="page-title mb-3">404 — Signal lost</p>
        <p className="mb-8 normal-case tracking-normal font-sans text-[var(--text-secondary)] max-w-[420px] mx-auto">
          This page isn&apos;t on the wire. It may have moved, or the link is outdated.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-[36px] border-2 border-[var(--text-primary)] px-4 font-mono text-[11px] uppercase tracking-[0.06em] font-bold text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-inverted transition-colors"
        >
          Back to feed
        </Link>
      </div>
    </div>
  )
}
