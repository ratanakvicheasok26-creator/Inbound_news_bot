"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

const SEARCH_PANEL_ID = "header-search-panel"

export function SearchBar() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length < 2) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
    setOpen(false)
    setQuery("")
  }

  return (
    <>
      {/* Search icon trigger — Tier 1 meta bar */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-[30px] h-[30px] border border-[var(--text-primary)] text-[var(--text-secondary)] hover:bg-[var(--text-primary)] hover:text-inverted transition-colors"
        aria-label="Search"
        aria-expanded={open}
        aria-controls={SEARCH_PANEL_ID}
      >
        <Search className="h-3.5 w-3.5" />
      </button>

      {/* Slide-down overlay */}
      {open && (
        <div
          id={SEARCH_PANEL_ID}
          className="absolute top-full left-0 w-full border-b border-[var(--text-primary)] bg-[var(--bg)] z-[110]"
        >
          <form onSubmit={handleSubmit} className="max-w-[960px] mx-auto px-4 md:px-10 py-4">
            <div className="flex items-center border border-[var(--text-primary)]">
              <span className="flex items-center justify-center w-[40px] h-[40px] border-r border-[var(--text-primary)] text-[var(--text-secondary)]">
                <Search className="h-4 w-4" />
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stories, sources, topics..."
                className="flex-1 px-4 h-[40px] bg-transparent font-mono text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => { setOpen(false); setQuery("") }}
                className="flex items-center justify-center w-[40px] h-[40px] border-l border-[var(--text-primary)] text-[var(--text-secondary)] hover:bg-[var(--text-primary)] hover:text-inverted transition-colors"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              Press Enter to search &middot; Esc to close
            </p>
          </form>
        </div>
      )}
    </>
  )
}
