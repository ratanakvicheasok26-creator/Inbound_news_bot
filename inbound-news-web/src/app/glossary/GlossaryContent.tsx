"use client"

import { useMemo, useState } from "react"
import { GLOSSARY_CATEGORIES, GLOSSARY_TERMS } from "@/lib/glossary"
import type { GlossaryCategory } from "@/lib/types"
import { Search } from "lucide-react"

export function GlossaryContent() {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<GlossaryCategory | "all">("all")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return GLOSSARY_TERMS.filter((term) => {
      const matchesCategory = activeCategory === "all" || term.category === activeCategory
      if (!matchesCategory) return false
      if (!q) return true
      const haystack = [
        term.term_en,
        term.definition_en,
        term.analogy,
        ...(term.aliases || []),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [search, activeCategory])

  const grouped = useMemo(() => {
    return GLOSSARY_CATEGORIES.map((cat) => ({
      ...cat,
      terms: filtered.filter((t) => t.category === cat.id),
    })).filter((g) => g.terms.length > 0)
  }, [filtered])

  return (
    <div className="container">
      <section className="py-10 max-w-[720px] mx-auto">
        <div className="section-header">
          <h1 className="page-title">Glossary</h1>
        </div>

        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-2">
          Tech jargon explained in plain English — so you can decode coverage instead of
          scrolling past it. Tap highlighted terms in a story to open the same definitions.
        </p>
        <p className="text-[13px] text-[var(--text-secondary)] mb-8">
          {GLOSSARY_TERMS.length} terms · English first · Khmer coming later
        </p>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
          <input
            type="search"
            placeholder="Search terms, aliases, or definitions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[var(--surface)] border border-[var(--border)] text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            aria-label="Search glossary"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-10" role="tablist" aria-label="Glossary topics">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-2 text-[12px] font-semibold transition-colors ${
              activeCategory === "all"
                ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
            }`}
          >
            All
          </button>
          {GLOSSARY_CATEGORIES.map((cat) => {
            const count = GLOSSARY_TERMS.filter((t) => t.category === cat.id).length
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-2 text-[12px] font-semibold transition-colors ${
                  activeCategory === cat.id
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
                }`}
              >
                {cat.label}
                <span className="ml-1.5 opacity-70 tabular-nums">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="space-y-10">
          {grouped.map((group) => (
            <section key={group.id} aria-labelledby={`glossary-${group.id}`}>
              <div className="mb-4">
                <h2 id={`glossary-${group.id}`} className="section-title">
                  {group.label}
                </h2>
                <p className="meta-text !normal-case tracking-normal mt-1">{group.blurb}</p>
              </div>

              <div className="space-y-0">
                {group.terms.map((term) => (
                  <article
                    key={term.slug}
                    id={term.slug}
                    className="py-6 border-b border-[var(--border)] last:border-0 scroll-mt-24"
                  >
                    <h3 className="story-title text-[20px] mb-2">{term.term_en}</h3>

                    {term.aliases && term.aliases.length > 0 && (
                      <p className="text-[12px] text-[var(--text-secondary)] mb-3">
                        Also matches: {term.aliases.slice(0, 4).join(" · ")}
                      </p>
                    )}

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
            </section>
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
