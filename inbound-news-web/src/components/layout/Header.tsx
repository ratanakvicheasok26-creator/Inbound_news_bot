"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { CATEGORIES } from "@/lib/categories"
import { ThemeToggle } from "@/components/ThemeToggle"
import { SearchBar } from "@/components/layout/SearchBar"
import { Menu, X, ChevronDown, Search } from "lucide-react"
import { supabase, signOut } from "@/lib/auth"
import type { User } from "@supabase/supabase-js"

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [topicsOpen, setTopicsOpen] = useState(false)
  const [lang, setLang] = useState<"en" | "km">("en")
  const [user, setUser] = useState<User | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const topicsRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMobileOpen(false)
    setTopicsOpen(false)
  }, [pathname])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
      const t = setTimeout(() => searchInputRef.current?.focus(), 200)
      return () => {
        clearTimeout(t)
        document.body.style.overflow = ""
      }
    }
    document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 70)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const centerLinks = [
    { href: "/blindspot", label: "Blindspot" },
    { href: "/", label: "Timeline" },
    { href: "/glossary", label: "Glossary" },
  ]

  function closeMobileMenu() {
    setMobileOpen(false)
    setSearchQuery("")
  }

  async function handleSignOut() {
    await signOut()
    setUser(null)
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
  }).toUpperCase()

  const fullDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).toUpperCase()

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[100] w-full">
        <div className={`transition-all duration-[250ms] ease-in-out ${
          scrolled
            ? "bg-[var(--bg)] shadow-sm border-b border-[#E5E5E5]"
            : "bg-transparent"
        }`}>

          {/* COLLAPSIBLE TOP SECTION — Meta bar + Logo */}
          <div className={`transition-all duration-[250ms] ease-in-out overflow-hidden ${
            scrolled ? "max-h-0 opacity-0" : "max-h-[250px] opacity-100"
          }`}>

            {/* TIER 1 — Top Meta Bar (hidden on mobile) */}
            <div className="hidden md:flex justify-between items-center border-b border-[var(--border)] px-4 md:px-10 h-[36px]">
              <span className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                {today} · {fullDate}
              </span>
              <div className="flex items-center gap-3 md:gap-4">
                <div className="hidden md:flex w-[64px] h-[30px] border border-[var(--text-primary)] overflow-hidden font-mono text-[10px] font-bold uppercase tracking-[0.06em]">
                  <button
                    className={`flex-1 flex items-center justify-center transition-colors ${
                      lang === "en"
                        ? "bg-[var(--text-primary)] text-inverted"
                        : "text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-inverted"
                    }`}
                    onClick={() => setLang("en")}
                  >
                    EN
                  </button>
                  <button
                    className={`flex-1 flex items-center justify-center transition-colors ${
                      lang === "km"
                        ? "bg-[var(--text-primary)] text-inverted"
                        : "text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-inverted"
                    }`}
                    onClick={() => setLang("km")}
                  >
                    ខ្មែរ
                  </button>
                </div>
                <ThemeToggle variant="header" />
                <SearchBar />
                <Link
                  href="/account"
                  className="flex items-center justify-center h-[30px] border border-[var(--text-primary)] px-3 font-mono text-[10px] md:text-[11px] uppercase tracking-[0.06em] font-bold text-[var(--text-secondary)] hover:bg-[var(--text-primary)] hover:text-inverted transition-colors"
                >
                  {user ? (
                    <span className="font-bold text-[10px]">
                      {(user.email?.[0] || "R").toUpperCase()}
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </Link>
                <Link
                  href="/donate"
                  className="flex items-center justify-center h-[30px] border border-[var(--text-primary)] px-3 font-mono text-[10px] md:text-[11px] uppercase tracking-[0.06em] font-bold text-[var(--text-secondary)] hover:bg-[var(--text-primary)] hover:text-inverted transition-colors"
                >
                  Donate
                </Link>
              </div>
            </div>

            {/* TIER 2 — Logo Masthead */}
            <div className="flex justify-center items-center border-b-2 border-[var(--text-primary)] py-2 md:py-6">
              <Link href="/" className="flex items-center max-w-[85vw] md:max-w-none">
                <Image
                  src="/logo-dark.png"
                  alt="Inbound Reports"
                  width={1983}
                  height={467}
                  priority
                  className="block h-[32px] w-auto md:h-[72px] dark:hidden"
                />
                <Image
                  src="/logo-light.png"
                  alt="Inbound Reports"
                  width={1982}
                  height={467}
                  priority
                  className="hidden h-[32px] w-auto md:h-[72px] dark:block"
                />
              </Link>
            </div>

            {/* TIER 3 — Main Navigation (desktop only, shown in expanded state) */}
            <div className="hidden md:grid grid-cols-3 items-center px-4 md:px-10 h-[44px]">
              <nav className="flex justify-start items-center">
                <button
                  type="button"
                  className="flex items-center justify-center min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 md:hidden cursor-pointer touch-manipulation"
                  onClick={() => setMobileOpen(prev => !prev)}
                  aria-label="Toggle menu"
                  aria-expanded={mobileOpen}
                >
                  <Menu className="h-5 w-5 pointer-events-none" />
                </button>
              </nav>
              <nav className="flex justify-center items-center gap-4 md:gap-6">
                {centerLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={pathname === link.href ? "page" : undefined}
                    className={`hidden md:inline font-mono text-[11px] font-bold uppercase tracking-[0.06em] px-2 py-1 transition-colors ${
                      pathname === link.href
                        ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--accent)]"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="hidden md:block relative">
                  <button
                    onClick={() => setTopicsOpen(!topicsOpen)}
                    aria-expanded={topicsOpen}
                    className="flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-secondary)] hover:text-[var(--accent)] px-2 py-1 transition-colors"
                  >
                    Topics
                    <ChevronDown className={`h-3 w-3 transition-transform ${topicsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {topicsOpen && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-[1px] w-[360px] bg-[var(--bg)] border border-[var(--text-primary)] z-50">
                      <div className="grid grid-cols-2 gap-0">
                        {CATEGORIES.map((cat) => (
                          <Link
                            key={cat.slug}
                            href={`/topic/${cat.slug}`}
                            aria-current={pathname === `/topic/${cat.slug}` ? "page" : undefined}
                            className={`block px-4 py-3 font-mono text-[11px] uppercase tracking-[0.06em] font-medium transition-colors border-b border-[var(--border)] ${
                              pathname === `/topic/${cat.slug}`
                                ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                                : "text-[var(--text-secondary)] hover:text-[var(--accent)]"
                            }`}
                          >
                            {cat.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </nav>
              <div />
            </div>
          </div>

          {/* COMPACT ROW — Always rendered; sleek on mobile, full nav when scrolled on desktop */}
          <div className={`grid grid-cols-3 items-center px-4 md:px-10 transition-all duration-[250ms] ease-in-out ${
            scrolled ? "h-14 md:h-16" : "h-[44px] md:hidden"
          }`}>
            {/* Left — hamburger on mobile, logo+fade on desktop */}
            <nav className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center justify-center min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 md:hidden cursor-pointer touch-manipulation"
                onClick={() => setMobileOpen(prev => !prev)}
                aria-label="Toggle menu"
                aria-expanded={mobileOpen}
              >
                <Menu className="h-5 w-5 pointer-events-none" />
              </button>
              <Link href="/" className={`hidden md:block transition-all duration-[250ms] ${
                scrolled ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}>
                <Image
                  src="/logo-dark.png"
                  alt="Inbound Reports"
                  width={1983}
                  height={467}
                  priority
                  className="h-8 w-auto dark:hidden"
                />
                <Image
                  src="/logo-light.png"
                  alt="Inbound Reports"
                  width={1982}
                  height={467}
                  priority
                  className="h-8 w-auto hidden dark:block"
                />
              </Link>
            </nav>

            {/* Center — nav links on desktop only */}
            <div className="flex justify-center items-center">
              <nav className="hidden md:flex items-center gap-4 md:gap-6">
                {centerLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={pathname === link.href ? "page" : undefined}
                    className={`font-mono text-[11px] font-bold uppercase tracking-[0.06em] px-2 py-1 transition-colors ${
                      pathname === link.href
                        ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--accent)]"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="relative" ref={topicsRef}>
                  <button
                    onClick={() => setTopicsOpen(!topicsOpen)}
                    aria-expanded={topicsOpen}
                    className="flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-secondary)] hover:text-[var(--accent)] px-2 py-1 transition-colors"
                  >
                    Topics
                    <ChevronDown className={`h-3 w-3 transition-transform ${topicsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {topicsOpen && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-[1px] w-[360px] bg-[var(--bg)] border border-[var(--text-primary)] z-50">
                      <div className="grid grid-cols-2 gap-0">
                        {CATEGORIES.map((cat) => (
                          <Link
                            key={cat.slug}
                            href={`/topic/${cat.slug}`}
                            aria-current={pathname === `/topic/${cat.slug}` ? "page" : undefined}
                            className={`block px-4 py-3 font-mono text-[11px] uppercase tracking-[0.06em] font-medium transition-colors border-b border-[var(--border)] ${
                              pathname === `/topic/${cat.slug}`
                                ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                                : "text-[var(--text-secondary)] hover:text-[var(--accent)]"
                            }`}
                          >
                            {cat.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </nav>
            </div>

            {/* Right — hidden on mobile, full on desktop */}
            <div className="hidden md:flex items-center justify-end gap-2">
              <SearchBar />
              <ThemeToggle variant="header" />
              <Link
                href="/account"
                className="flex items-center justify-center h-[28px] border border-[var(--text-primary)] px-2 font-mono text-[10px] md:text-[10px] uppercase tracking-[0.06em] font-bold text-[var(--text-secondary)] hover:bg-[var(--text-primary)] hover:text-inverted transition-colors"
              >
                {user ? (
                  <span className="font-bold text-[10px]">
                    {(user.email?.[0] || "R").toUpperCase()}
                  </span>
                ) : (
                  "Sign In"
                )}
              </Link>
              <Link
                href="/donate"
                className="flex items-center justify-center h-[28px] border border-[var(--text-primary)] px-2 font-mono text-[10px] md:text-[10px] uppercase tracking-[0.06em] font-bold text-[var(--text-secondary)] hover:bg-[var(--text-primary)] hover:text-inverted transition-colors"
              >
                Donate
              </Link>
            </div>
          </div>

        </div>
      </header>

      {/* SPACER — Prevents fixed header from covering content */}
      <div className={`transition-all duration-[250ms] ease-in-out ${
        scrolled ? "h-14 md:h-16" : "h-[110px] md:h-[200px]"
      }`} />

      {/* Mobile Overlay — Slide-in panel */}
      {mobileOpen && (
        <div className="mobile-overlay-backdrop" onClick={closeMobileMenu}>
          <div
            className="mobile-overlay-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
              onClick={closeMobileMenu}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Search */}
            <div className="px-6 pt-12 pb-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const q = searchQuery.trim()
                  if (q.length >= 2) {
                    router.push(`/search?q=${encodeURIComponent(q)}`)
                    closeMobileMenu()
                  }
                }}
              >
                <div className="flex items-center border border-[var(--text-primary)]">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search stories, sources, topics..."
                    className="flex-1 px-4 h-[44px] bg-transparent font-mono text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="flex items-center justify-center w-[44px] h-[44px] border-l border-[var(--text-primary)] text-[var(--text-secondary)] hover:bg-[var(--text-primary)] hover:text-inverted transition-colors"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>

            {/* Nav links */}
            <div className="px-6">
              {centerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={`block py-4 font-mono text-sm font-bold uppercase tracking-[0.08em] border-b border-[var(--border)] transition-colors ${
                    pathname === link.href
                      ? "text-[var(--accent)]"
                      : "text-[var(--text-primary)] hover:text-[var(--accent)]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/account"
                onClick={closeMobileMenu}
                className="block py-4 font-mono text-sm font-bold uppercase tracking-[0.08em] border-b border-[var(--border)] text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
              >
                {user ? "My Account" : "Sign In"}
              </Link>
              <Link
                href="/donate"
                onClick={closeMobileMenu}
                className="block py-4 font-mono text-sm font-bold uppercase tracking-[0.08em] border-b border-[var(--border)] text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
              >
                Donate
              </Link>
            </div>

            {/* Language + Theme */}
            <div className="px-6 mt-6 flex items-center gap-3">
              <div className="flex border border-[var(--text-primary)] overflow-hidden font-mono text-[11px] font-bold uppercase tracking-[0.06em]">
                <button
                  className={`px-3 py-1.5 transition-colors ${
                    lang === "en"
                      ? "bg-[var(--text-primary)] text-inverted"
                      : "text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-inverted"
                  }`}
                  onClick={() => setLang("en")}
                >
                  EN
                </button>
                <div className="w-px bg-[var(--border)]" />
                <button
                  className={`px-3 py-1.5 transition-colors ${
                    lang === "km"
                      ? "bg-[var(--text-primary)] text-inverted"
                      : "text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-inverted"
                  }`}
                  onClick={() => setLang("km")}
                >
                  ខ្មែរ
                </button>
              </div>
              <ThemeToggle variant="header" />
            </div>

            {/* Topics */}
            <div className="px-6 mt-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-secondary)] mb-4 font-bold">
                Topics
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                {CATEGORIES.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/topic/${cat.slug}`}
                    onClick={closeMobileMenu}
                    aria-current={pathname === `/topic/${cat.slug}` ? "page" : undefined}
                    className="block py-3 font-mono text-[11px] uppercase tracking-wider font-medium text-[var(--text-secondary)] border-b border-[var(--border)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Sign Out */}
            {user && (
              <div className="px-6 mt-8 pb-10">
                <button
                  onClick={() => { handleSignOut(); closeMobileMenu() }}
                  className="w-full py-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
