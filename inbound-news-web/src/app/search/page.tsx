"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { StoryRow } from "@/components/story/StoryRow"
import type { Story, Article } from "@/lib/types"
import { Search } from "lucide-react"

function SearchResults() {
  const searchParams = useSearchParams()
  const q = searchParams.get("q") || ""

  const [stories, setStories] = useState<Story[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const runSearch = useCallback(async (query: string) => {
    if (query.length < 2) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setStories(data.stories ?? [])
      setArticles(data.articles ?? [])
    } catch {
      setStories([])
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (q) runSearch(q)
  }, [q, runSearch])

  const totalResults = stories.length + articles.length

  return (
    <div className="container">
      <section className="py-10 md:py-16 max-w-[960px] mx-auto">
        {/* Header */}
        <div className="pb-8 border-b-2 border-[var(--text-primary)]">
          <h1 className="page-title">
            SEARCH
          </h1>
          {q && (
            <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              {loading ? (
                "Searching..."
              ) : searched ? (
                <>{totalResults} result{totalResults !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;</>
              ) : null}
            </div>
          )}
        </div>

        {/* No query state */}
        {!q && (
          <div className="py-20 text-center">
            <Search className="h-8 w-8 mx-auto mb-4 text-[var(--text-secondary)]" />
            <p className="font-mono text-[12px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              Use the search icon in the header to search stories and sources.
            </p>
          </div>
        )}

        {/* Empty results */}
        {q && searched && !loading && totalResults === 0 && (
          <div className="py-20 text-center">
            <p className="font-mono text-[14px] text-[var(--text-secondary)] mb-2">
              No results for &ldquo;{q}&rdquo;
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              Try a different keyword or check your spelling.
            </p>
          </div>
        )}

        {/* Stories results */}
        {stories.length > 0 && (
          <div className="mt-10">
            <div className="section-header mb-4">
              <h2 className="section-title">
                <span className="section-number mr-3">S</span>
                Stories
              </h2>
              <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                {stories.length} result{stories.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div>
              {stories.map((story) => (
                <StoryRow key={story.id} story={story} />
              ))}
            </div>
          </div>
        )}

        {/* Articles results */}
        {articles.length > 0 && (
          <div className="mt-10">
            <div className="section-header mb-4">
              <h2 className="section-title">
                <span className="section-number mr-3">A</span>
                Articles
              </h2>
              <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                {articles.length} result{articles.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="border-t-2 border-[var(--text-primary)]">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between gap-4 py-4 border-b border-[var(--border)] hover:bg-[var(--surface-alt)] transition-colors px-2 -mx-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[13px] font-bold text-[var(--text-primary)] leading-tight line-clamp-2">
                      {article.title}
                    </p>
                    {article.summary && (
                      <p className="mt-1 font-mono text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                        {article.summary}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {article.source_name && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-secondary)] font-bold">
                        {article.source_name}
                      </span>
                    )}
                    {article.published_at && (
                      <span className="block font-mono text-[10px] text-[var(--text-secondary)] mt-0.5">
                        {new Date(article.published_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="container">
        <section className="py-16 md:py-24 max-w-[960px] mx-auto text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">Loading...</p>
        </section>
      </div>
    }>
      <SearchResults />
    </Suspense>
  )
}
