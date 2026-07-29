"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { Menu, ChevronDown } from "lucide-react"
import { useActiveSection } from "@/hooks/useActiveSection"

interface LegalPageLayoutProps {
  title: string
  lastUpdated?: string
  sections?: { id: string; label: string }[]
  children: ReactNode
}

export function LegalPageLayout({
  title,
  lastUpdated = "July 29, 2026",
  sections,
  children,
}: LegalPageLayoutProps) {
  const [mobileTocOpen, setMobileTocOpen] = useState(false)
  const sectionIds = sections?.map((s) => s.id) ?? []
  const activeSection = useActiveSection(sectionIds)

  const headerContent = (
    <>
      <div className="section-header">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent)] font-bold">
          Legal &amp; Trust
        </span>
        <h1 className="page-title mt-1">{title}</h1>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-secondary)] mt-6 mb-10 pb-6 border-b border-[var(--border)]">
        Last Updated: {lastUpdated}
      </p>
    </>
  )

  if (!sections || sections.length === 0) {
    return (
      <div className="container">
        <article className="py-12 max-w-[720px] mx-auto">
          {headerContent}
          <div className="legal-prose">{children}</div>
        </article>
      </div>
    )
  }

  return (
    <div className="container">
      <article className="py-12 max-w-[860px] mx-auto">
        {headerContent}

        <div className="lg:hidden mb-8">
          <button
            onClick={() => setMobileTocOpen(!mobileTocOpen)}
            className="w-full flex items-center justify-between border border-[var(--border)] rounded-lg px-4 py-3 bg-[var(--surface)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Menu className="h-4 w-4" />
              On this page
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${mobileTocOpen ? "rotate-180" : ""}`} />
          </button>
          {mobileTocOpen && (
            <nav className="mt-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] overflow-hidden">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={() => setMobileTocOpen(false)}
                  className={`block px-4 py-2.5 text-sm border-b border-[var(--border)] last:border-0 transition-colors ${
                    activeSection === s.id
                      ? "text-[var(--accent)] font-semibold bg-[var(--surface-alt)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
                  }`}
                >
                  {s.label}
                </a>
              ))}
            </nav>
          )}
        </div>

        <div className="flex gap-10">
          <div className="flex-1 min-w-0">
            <div className="legal-prose">{children}</div>
          </div>

          <aside className="hidden lg:block w-[220px] shrink-0">
            <div className="sticky top-16">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-secondary)] font-bold">
                On this page
              </span>
              <nav className="mt-3 space-y-0.5 border-l border-[var(--border)]">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={`block pl-4 py-2 text-[13px] leading-snug border-l transition-all ${
                      activeSection === s.id
                        ? "border-[var(--accent)] text-[var(--text-primary)] font-semibold -ml-px"
                        : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)]"
                    }`}
                  >
                    {s.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        </div>
      </article>
    </div>
  )
}
