import Link from "next/link"

export default function NotFound() {
  return (
    <div className="container py-20 text-center">
      <p className="meta-text text-[var(--accent)] mb-3">Inbound Reports</p>
      <p className="page-title mb-3">Page not found</p>
      <p className="mb-8 text-[var(--text-secondary)] max-w-[420px] mx-auto">
        This page isn&apos;t in our clustered coverage. It may have moved, or the link is outdated.
      </p>
      <Link href="/" className="btn-primary">
        Back to feed
      </Link>
    </div>
  )
}
