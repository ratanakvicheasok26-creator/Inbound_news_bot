"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { CATEGORIES } from "@/lib/categories"
import { ThemeToggle } from "@/components/ThemeToggle"
import { LiveSearch } from "@/components/layout/LiveSearch"
import { Menu, X, ChevronDown, Search } from "lucide-react"
import { supabase, signOut } from "@/lib/auth"
import type { User } from "@supabase/supabase-js"

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/glossary", label: "Glossary" },
  { href: "/about", label: "About" },
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [topicsOpen, setTopicsOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [mounted, setMounted] = useState(false)
  const topicsRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  /* eslint-disable react-hooks/set-state-in-effect -- gate client-only rendering after first render */
  useEffect(() => {
    setMounted(true)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (topicsRef.current && !topicsRef.current.contains(e.target as Node)) {
        setTopicsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect -- close overlays on route change */
  useEffect(() => {
    setMobileOpen(false)
    setTopicsOpen(false)
  }, [pathname])
  /* eslint-enable react-hooks/set-state-in-effect */

  const closeMobileMenu = useCallback(() => {
    setMobileOpen(false)
    setSearchQuery("")
  }, [])

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = ""
      return
    }

    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"

    // Focus close button (not search) — autofocusing search opens the keyboard and breaks iOS drawers
    const t = setTimeout(() => closeBtnRef.current?.focus(), 50)

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobileMenu()
    }
    document.addEventListener("keydown", onKey)

    return () => {
      clearTimeout(t)
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [mobileOpen, closeMobileMenu])

  async function handleSignOut() {
    await signOut()
    setUser(null)
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q.length >= 2) {
      router.push(`/search?q=${encodeURIComponent(q)}`)
      closeMobileMenu()
    }
  }

  function openMobileMenu() {
    setTopicsOpen(false)
    setMobileOpen(true)
  }

  const mobileDrawer =
    mounted &&
    mobileOpen &&
    createPortal(
      <div
        className="mobile-overlay-backdrop"
        role="presentation"
        onClick={closeMobileMenu}
      >
        <div
          className="mobile-overlay-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--border)] shrink-0">
            <span className="font-display text-lg font-semibold">Menu</span>
            <button
              ref={closeBtnRef}
              type="button"
              className="w-11 h-11 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
              onClick={closeMobileMenu}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <form onSubmit={submitSearch} className="px-5 py-4">
              <div className="flex items-center border border-[var(--border)] rounded-[var(--radius-sm)] overflow-hidden bg-[var(--bg)]">
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stories and sources…"
                  className="flex-1 min-w-0 px-3 h-11 bg-transparent text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none"
                  enterKeyHint="search"
                />
                <button
                  type="submit"
                  className="w-11 h-11 flex items-center justify-center text-[var(--text-secondary)]"
                  aria-label="Submit search"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </form>

            <nav className="px-3 pb-4" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className="block px-3 py-3.5 text-[15px] font-medium border-b border-[var(--border)] text-[var(--text-primary)]"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/search"
                onClick={closeMobileMenu}
                className="block px-3 py-3.5 text-[15px] font-medium border-b border-[var(--border)] text-[var(--text-primary)]"
              >
                Search
              </Link>
              <Link
                href="/account"
                onClick={closeMobileMenu}
                className="block px-3 py-3.5 text-[15px] font-medium border-b border-[var(--border)] text-[var(--text-primary)]"
              >
                {user ? "Account" : "Sign in"}
              </Link>
              <Link
                href="/donate"
                onClick={closeMobileMenu}
                className="block px-3 py-3.5 text-[15px] font-medium border-b border-[var(--border)] text-[var(--text-primary)]"
              >
                Donation
              </Link>
            </nav>

            <div className="px-5 pt-2 pb-10">
              <p className="meta-text mb-3">Topics</p>
              <div className="grid grid-cols-2 gap-1">
                {CATEGORIES.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/topic/${cat.slug}`}
                    onClick={closeMobileMenu}
                    className="px-2 py-2.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    handleSignOut()
                    closeMobileMenu()
                  }}
                  className="mt-6 w-full btn-ghost"
                >
                  Sign out
                </button>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    )

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="hamburger-btn"
              onClick={openMobileMenu}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-site-menu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <Link href="/" className="flex items-center shrink-0 min-w-0">
              <Image
                src="/logo-dark.png"
                alt="Inbound Reports"
                width={1983}
                height={467}
                priority
                className="h-7 w-auto md:h-8 dark:hidden"
              />
              <Image
                src="/logo-light.png"
                alt="Inbound Reports"
                width={1982}
                height={467}
                priority
                className="h-7 w-auto md:h-8 hidden dark:block"
              />
            </Link>
          </div>

          <nav className="site-nav hidden lg:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className="site-nav-link"
              >
                {link.label}
              </Link>
            ))}

            <div className="relative" ref={topicsRef}>
              <button
                type="button"
                onClick={() => setTopicsOpen((o) => !o)}
                aria-expanded={topicsOpen}
                className="site-nav-link inline-flex items-center gap-1"
              >
                Topics
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${topicsOpen ? "rotate-180" : ""}`} />
              </button>
              {topicsOpen && (
                <div className="absolute top-full left-0 mt-1 w-[320px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-md z-50 p-2 grid grid-cols-2 gap-0.5">
                  {CATEGORIES.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/topic/${cat.slug}`}
                      aria-current={pathname === `/topic/${cat.slug}` ? "page" : undefined}
                      className="block px-3 py-2 text-[13px] rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]"
                    >
                      {cat.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <LiveSearch />
            <ThemeToggle />
            <Link href="/account" className="btn-ghost hidden sm:inline-flex">
              {user ? (user.email?.[0] || "A").toUpperCase() : "Sign in"}
            </Link>
            <Link href="/donate" className="btn-primary hidden lg:inline-flex">
              Donation
            </Link>
          </div>
        </div>
      </header>

      <div id="mobile-site-menu">{mobileDrawer}</div>
    </>
  )
}
