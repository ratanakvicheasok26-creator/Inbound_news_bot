"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Search, X, CornerDownLeft } from "lucide-react"
import { getCategoryLabel } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import type { Story, Article } from "@/lib/types"

type Suggestion = { kind: "story"; item: Story } | { kind: "article"; item: Article }

const DEBOUNCE_MS = 180
const MIN_QUERY = 1

export function LiveSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [stories, setStories] = useState<Story[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)

  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchIdRef = useRef(0)

  const items = useMemo<Suggestion[]>(() => {
    const list: Suggestion[] = []
    for (const s of stories) list.push({ kind: "story", item: s })
    for (const a of articles) list.push({ kind: "article", item: a })
    return list
  }, [stories, articles])

  const fetchSuggestions = useCallback(async (term: string) => {
    const id = ++fetchIdRef.current
    setLoading(true)
    try {
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`)
      const data = await res.json()
      if (id !== fetchIdRef.current) return
      setStories(data.stories ?? [])
      setArticles(data.articles ?? [])
      setActive(-1)
    } catch {
      if (id !== fetchIdRef.current) return
      setStories([])
      setArticles([])
    } finally {
      if (id === fetchIdRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const term = query.trim()
    if (term.length < MIN_QUERY) {
      setStories([])
      setArticles([])
      setActive(-1)
      setLoading(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      setOpen(true)
      fetchSuggestions(term)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchSuggestions])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false)
        setActive(-1)
      }
    }
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onDown)
    }
  }, [])

  function openSearch() {
    setOpen(true)
    inputRef.current?.focus()
    const term = query.trim()
    if (term.length >= MIN_QUERY) fetchSuggestions(term)
  }

  function goToItem(index: number) {
    const entry = items[index]
    if (!entry) return
    setOpen(false)
    if (entry.kind === "story") {
      router.push(`/story/${entry.item.id}`)
    } else {
      window.open(entry.item.url, "_blank", "noopener,noreferrer")
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (i + 1) % Math.max(items.length, 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1))
    } else if (e.key === "Enter") {
      if (active >= 0 && items[active]) {
        e.preventDefault()
        goToItem(active)
      } else {
        const term = query.trim()
        if (term.length >= MIN_QUERY) {
          setOpen(false)
          router.push(`/search?q=${encodeURIComponent(term)}`)
        }
      }
    }
  }

  const total = stories.length + articles.length

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={openSearch}
        className="hidden sm:inline-flex btn-ghost"
        aria-label="Search"
        aria-expanded={open}
      >
        <Search className="h-4 w-4" />
        <span className="hidden xl:inline">Search</span>
      </button>

      {open && (
        <div className="fixed inset-x-0 top-[var(--header-height,64px)] z-[120] bg-[var(--bg)] border-b border-[var(--border)] shadow-md">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const term = query.trim()
              if (term.length >= MIN_QUERY) {
                setOpen(false)
                router.push(`/search?q=${encodeURIComponent(term)}`)
              }
            }}
            className="max-w-[960px] mx-auto px-4 md:px-10 py-4"
          >
            <div className="flex items-center border border-[var(--text-primary)]">
              <span className="flex items-center justify-center w-[40px] h-[40px] border-r border-[var(--text-primary)] text-[var(--text-secondary)]">
                <Search className="h-4 w-4" />
              </span>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search stories and sources…"
                autoComplete="off"
                autoFocus
                className="flex-1 px-4 h-[40px] bg-transparent font-mono text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none"
              />
              {loading ? (
                <span className="flex items-center justify-center w-[40px] h-[40px] border-l border-[var(--text-primary)] text-[var(--text-secondary)]">
                  <span className="animate-spin h-3 w-3 border border-[var(--text-secondary)] border-t-transparent rounded-full" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("")
                    setOpen(false)
                  }}
                  className="flex items-center justify-center w-[40px] h-[40px] border-l border-[var(--text-primary)] text-[var(--text-secondary)] hover:bg-[var(--text-primary)] hover:text-inverted transition-colors"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>

          {total > 0 ? (
            <div className="max-w-[960px] mx-auto px-4 md:px-10 pb-4 max-h-[60vh] overflow-y-auto">
              {stories.length > 0 && (
                <div className="mb-1">
                  <p className="meta-text px-1 py-1.5 text-[10px] uppercase tracking-[0.08em]">
                    Stories
                  </p>
                  {stories.map((s, i) => (
                    <Link
                      key={s.id}
                      href={`/story/${s.id}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2 px-2 py-2 text-[13px] ${
                        active === i ? "bg-[var(--surface-alt)]" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-[var(--text-primary)]">{s.title}</span>
                      </span>
                      <span className="meta-text shrink-0">
                        {getCategoryLabel(s.category || "") || "News"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {articles.length > 0 && (
                <div>
                  <p className="meta-text px-1 py-1.5 text-[10px] uppercase tracking-[0.08em]">
                    Articles
                  </p>
                  {articles.map((a, i) => {
                    const idx = stories.length + i
                    return (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setOpen(false)}
                        onMouseEnter={() => setActive(idx)}
                        className={`flex items-center gap-2 px-2 py-2 text-[13px] ${
                          active === idx ? "bg-[var(--surface-alt)]" : ""
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
                          {a.title}
                        </span>
                        <span className="meta-text shrink-0">
                          {a.source_name || a.source_domain}
                        </span>
                      </a>
                    )
                  })}
                </div>
              )}
              <div className="mt-2 border-t border-[var(--border)] pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const term = query.trim()
                    setOpen(false)
                    if (term.length >= MIN_QUERY) router.push(`/search?q=${encodeURIComponent(term)}`)
                  }}
                  className="w-full flex items-center justify-between px-2 py-2 text-[13px] text-[var(--accent)] hover:bg-[var(--surface-alt)] transition-colors"
                >
                  <span>See all results for “{query.trim()}”</span>
                  <CornerDownLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : query.trim().length >= MIN_QUERY && !loading ? (
            <div className="max-w-[960px] mx-auto px-4 md:px-10 pb-4">
              <p className="px-2 py-2 text-[13px] text-[var(--text-secondary)]">
                No matches yet — press Enter to search all fields.
              </p>
            </div>
          ) : null}

          {!query.trim() && (
            <p className="max-w-[960px] mx-auto px-4 md:px-10 pb-4 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              Type to search &middot; Enter for full results &middot; Esc to close
            </p>
          )}
        </div>
      )}
    </div>
  )
}
