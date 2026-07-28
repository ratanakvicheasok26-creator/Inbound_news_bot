import type { ReactNode } from "react"

interface LegalPageLayoutProps {
  title: string
  lastUpdated?: string
  children: ReactNode
}

export function LegalPageLayout({
  title,
  lastUpdated = "July 2026",
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="container">
      <article className="py-10 max-w-[720px] mx-auto">
        <div className="section-header">
          <h1 className="page-title">{title}</h1>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mb-8">
          Last Updated: {lastUpdated}
        </p>
        <div className="legal-prose">{children}</div>
      </article>
    </div>
  )
}
