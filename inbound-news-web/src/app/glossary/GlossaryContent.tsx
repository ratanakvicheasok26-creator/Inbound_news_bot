"use client"

import { useMemo, useState } from "react"
import { GLOSSARY_CATEGORIES, GLOSSARY_TERMS, glossaryCopy } from "@/lib/glossary"
import type { GlossaryCategory } from "@/lib/types"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import { Search } from "lucide-react"

export function GlossaryContent() {
  const { locale, t } = useI18n()
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
        term.term_km,
        term.definition_en,
        term.definition_km,
        term.analogy,
        term.analogy_km,
        ...(term.aliases || []),
      ]
        .filter(Boolean)
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
      <section className="py-8 sm:py-10 max-w-[720px] mx-auto">
        <div className="section-header">
          <h1 className="page-title">{t("glossary.title")}</h1>
        </div>

        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-2">
          {t("glossary.intro")}
        </p>
        <p className="text-[13px] text-[var(--text-secondary)] mb-8">
          {t("glossary.meta", { count: GLOSSARY_TERMS.length })}
        </p>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
          <input
            type="search"
            placeholder={t("glossary.placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[var(--surface)] border border-[var(--border)] text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            aria-label={t("glossary.placeholder")}
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-10" role="tablist" aria-label={t("glossary.title")}>
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
            {t("glossary.all")}
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
                {locale === "km" ? cat.label_km : cat.label}
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
                  {locale === "km" ? group.label_km : group.label}
                </h2>
                <p className="meta-text !normal-case tracking-normal mt-1">
                  {locale === "km" ? group.blurb_km : group.blurb}
                </p>
              </div>

              <div className="space-y-0">
                {group.terms.map((term) => {
                  const copy = glossaryCopy(term, locale)
                  return (
                    <article
                      key={term.slug}
                      id={term.slug}
                      className="py-8 border-b border-[var(--border)] last:border-0 scroll-mt-[calc(var(--header-h)+12px)]"
                    >
                      <h3 className="story-title text-[20px] mb-1">{copy.heading}</h3>
                      {copy.nativeName ? (
                        <p className="text-[14px] text-[var(--text-secondary)] mb-2">{copy.nativeName}</p>
                      ) : null}

                      {term.aliases && term.aliases.length > 0 && (
                        <p className="text-[12px] text-[var(--text-secondary)] mb-3">
                          {t("glossary.alsoMatches")} {term.aliases.slice(0, 4).join(" · ")}
                        </p>
                      )}

                      <p className="text-[14px] text-[var(--text-primary)] leading-relaxed mb-3">
                        {copy.definition}
                      </p>

                      <div className="p-3 bg-[var(--surface-alt)] border-l-2 border-[var(--accent)]">
                        <p className="text-[13px] text-[var(--text-secondary)] italic">
                          &ldquo;{copy.analogy}&rdquo;
                        </p>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state py-12">
            <p>{t("glossary.noResults")}</p>
          </div>
        )}
      </section>
    </div>
  )
}
