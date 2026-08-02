"use client"

import { useState, useEffect, useCallback, Suspense, FormEvent } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { StoryRow } from "@/components/story/StoryRow"
import { CATEGORIES } from "@/lib/categories"
import type { Story, Article, WebResult } from "@/lib/types"
import { Search, Globe } from "lucide-react"
import { formatDistanceToNow } from "@/lib/utils"

const DEBOUNCE_MS = 250
const MIN_QUERY = 1

function SearchResults() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQ = searchParams.get("q") || ""

  const [input, setInput] = useState(initialQ)
  const [stories, setStories] = useState<Story[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [webResults, setWebResults] = useState<WebResult[]>([])
  const [webLoading, setWebLoading] = useState(false)
  const [webAvailable, setWebAvailable] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) return
    setLoading(true)
    setWebLoading(true)
    setError(null)
    try {
      const [res, webRes] = await Promise.all([
        fetch(`/api/search?q=${encodeURIComponent(query)}`),
        fetch(`/api/websearch?q=${encodeURIComponent(query)}`),
      ])
      const data = await res.json()
      setStories(data.stories ?? [])
      setArticles(data.articles ?? [])
      if (data.error) setError(data.error)

      const webData = await webRes.json()
      setWebResults(webData.results ?? [])
      setWebAvailable(webData.available !== false)
    } catch {
      setStories([])
      setArticles([])
      setWebResults([])
      setError("Search failed. Try again.")
    } finally {
      setLoading(false)
      setWebLoading(false)
    }
  }, [])

  useEffect(() => {
    const term = input.trim()
    const t = setTimeout(() => {
      if (term.length < MIN_QUERY) {
        setStories([])
        setArticles([])
        setWebResults([])
        setError(null)
        return
      }
      router.replace(`/search?q=${encodeURIComponent(term)}`, { scroll: false })
      runSearch(term)
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [input, router, runSearch])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (trimmed.length < MIN_QUERY) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  const searched = input.trim().length >= MIN_QUERY
  const totalResults = stories.length + articles.length

  return (
    <div className="container container-md py-10 md:py-14">
      <h1 className="page-title mb-2">Search</h1>
      {searched && (
        <p className="meta-text mb-6">
          {loading
            ? "Searching…"
            : `${totalResults} result${totalResults !== 1 ? "s" : ""} for “${input.trim()}”`}
        </p>
      )}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex items-stretch border border-[var(--border)] rounded-[var(--radius)] overflow-hidden bg-[var(--surface)]">
          <span className="flex items-center justify-center w-11 shrink-0 text-[var(--text-secondary)]">
            <Search className="h-4 w-4" aria-hidden />
          </span>
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search stories and sources…"
            aria-label="Search query"
            className="min-w-0 flex-1 px-2 h-11 bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none"
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" className="btn-primary rounded-none h-11">
            Search
          </button>
        </div>
        <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
          Results appear as you type — even from a single letter.
        </p>
      </form>

      {!searched && (
        <p className="text-[var(--text-secondary)] py-8">
          Type a keyword to search stories and source articles.
        </p>
      )}

      {error && (
        <p className="text-[14px] text-[var(--accent)] mb-4">{error}</p>
      )}

      {searched && !loading && totalResults === 0 && !error && (
        <div className="py-12">
          <p className="text-[16px] text-[var(--text-primary)] mb-1">No results for “{input.trim()}”</p>
          <p className="text-[14px] text-[var(--text-secondary)] mb-6">
            All words are matched separately — try a shorter keyword or a topic below.
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/topic/${cat.slug}`}
                className="px-3 py-1.5 text-[13px] rounded-full border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-colors"
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {stories.length > 0 && (
        <section className="mb-10">
          <div className="section-header">
            <h2 className="section-title">Stories</h2>
            <span className="meta-text">{stories.length}</span>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] px-5">
            {stories.map((story) => (
              <StoryRow key={story.id} story={story} />
            ))}
          </div>
        </section>
      )}

      {articles.length > 0 && (
        <section>
          <div className="section-header">
            <h2 className="section-title">Articles</h2>
            <span className="meta-text">{articles.length}</span>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] divide-y divide-[var(--border)]">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-5 py-4 hover:bg-[var(--surface-alt)] transition-colors"
              >
                <p className="text-[15px] font-semibold leading-snug line-clamp-2">{article.title}</p>
                {article.summary && (
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)] line-clamp-2">
                    {article.summary}
                  </p>
                )}
                <div className="mt-2 flex gap-3 meta-text">
                  {article.source_name && <span>{article.source_name}</span>}
                  {article.published_at && (
                    <span>{formatDistanceToNow(article.published_at)}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {searched && webLoading && (
        <section className="mt-10">
          <div className="section-header">
            <h2 className="section-title">Live web</h2>
            <span className="meta-text">Searching the web…</span>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] px-5 py-6 text-[13px] text-[var(--text-secondary)]">
            Fetching fresh results from the web…
          </div>
        </section>
      )}

      {searched && !webLoading && webAvailable && webResults.length > 0 && (
        <section className="mt-10">
          <div className="section-header">
            <h2 className="section-title flex items-center gap-2">
              <Globe className="h-4 w-4" aria-hidden />
              Live web
            </h2>
            <span className="meta-text">{webResults.length}</span>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] divide-y divide-[var(--border)]">
            {webResults.map((result) => (
              <a
                key={result.url}
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-5 py-4 hover:bg-[var(--surface-alt)] transition-colors"
              >
                <p className="text-[15px] font-semibold leading-snug line-clamp-2">{result.title}</p>
                {result.summary && (
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)] line-clamp-2">
                    {result.summary}
                  </p>
                )}
                <div className="mt-2 flex gap-3 meta-text">
                  <span>{result.source_name}</span>
                  {result.published_at && (
                    <span>{formatDistanceToNow(result.published_at)}</span>
                  )}
                </div>
              </a>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
            Fresh web results via live search — last 7 days.
          </p>
        </section>
      )}

      {searched && !webLoading && webAvailable && webResults.length === 0 && (
        <section className="mt-10">
          <div className="section-header">
            <h2 className="section-title flex items-center gap-2">
              <Globe className="h-4 w-4" aria-hidden />
              Live web
            </h2>
            <span className="meta-text">0</span>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)]">
            No fresh web results for the past 7 days.
          </p>
        </section>
      )}

      {searched && !webLoading && !webAvailable && (
        <p className="mt-10 text-[12px] text-[var(--text-secondary)]">
          Live web search isn&apos;t configured on this deploy.
        </p>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container py-16 text-center text-[var(--text-secondary)]">
          Loading…
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  )
}
