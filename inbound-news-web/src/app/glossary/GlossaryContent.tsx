"use client"

import { useState } from "react"
import { GLOSSARY_TERMS } from "@/lib/glossary"
import { Search } from "lucide-react"

export function GlossaryContent() {
  const [search, setSearch] = useState("")
  const [activeLetter, setActiveLetter] = useState<string | null>(null)

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

  const filtered = GLOSSARY_TERMS.filter((term) => {
    const matchesSearch = !search ||
      term.term_en.toLowerCase().includes(search.toLowerCase()) ||
      term.definition_en.toLowerCase().includes(search.toLowerCase())
    const matchesLetter = !activeLetter || term.term_en[0].toUpperCase() === activeLetter
    return matchesSearch && matchesLetter
  })

  return (
    <div className="container">
      <section className="py-10 max-w-[720px] mx-auto">
        <div className="section-header">
          <h1 className="page-title">Tech Glossary</h1>
        </div>

        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-8">
          The digital literacy engine. A persistent, searchable encyclopedia of tech jargon
          that compounds in value over time.
        </p>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search tech terms..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveLetter(null) }}
            className="w-full pl-10 pr-4 py-3 bg-[var(--surface)] border border-[var(--border)] text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 mb-8">
          <button
            onClick={() => setActiveLetter(null)}
            className={`px-3 py-2 md:px-2 md:py-1 font-mono text-[11px] font-medium transition-colors ${
              !activeLetter ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            All
          </button>
          {letters.map((letter) => {
            const hasTerms = GLOSSARY_TERMS.some((t) => t.term_en[0].toUpperCase() === letter)
            return (
              <button
                key={letter}
                onClick={() => setActiveLetter(activeLetter === letter ? null : letter)}
                disabled={!hasTerms}
                className={`px-3 py-2 md:px-2 md:py-1 font-mono text-[11px] font-medium transition-colors ${
                  activeLetter === letter
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                    : hasTerms
                      ? "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      : "text-[var(--border)] cursor-not-allowed"
                }`}
              >
                {letter}
              </button>
            )
          })}
        </div>

        <div className="space-y-0">
          {filtered.map((term) => (
            <article
              key={term.slug}
              id={term.slug}
              className="py-6 border-b border-[var(--border)] last:border-0 scroll-mt-24"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h2 className="story-title text-[20px]">
                    {term.term_en}
                  </h2>
                </div>
                {term.story_count > 0 && (
                  <span className="font-mono text-[10px] text-[var(--text-secondary)] tabular-nums shrink-0">
                    {term.story_count} stories
                  </span>
                )}
              </div>

              <p className="text-[14px] text-[var(--text-primary)] leading-relaxed mb-3">
                {term.definition_en}
              </p>

              <div className="p-3 bg-[var(--surface-alt)] border-l-2 border-[var(--accent)]">
                <p className="text-[13px] text-[var(--text-secondary)] italic">
                  &ldquo;{term.analogy}&rdquo;
                </p>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state py-12">
            <p>No terms match your search.</p>
          </div>
        )}
      </section>
    </div>
  )
}
