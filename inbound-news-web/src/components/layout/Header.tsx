"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { CATEGORIES } from "@/lib/categories"
import { ThemeToggle } from "@/components/ThemeToggle"
import { LiveSearch } from "@/components/layout/LiveSearch"
import { Menu, X, ChevronDown, UserRound } from "lucide-react"
import { supabase, signOut } from "@/lib/auth"
import type { User } from "@supabase/supabase-js"

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/brief", label: "Brief" },
  { href: "/compare", label: "Compare" },
  { href: "/blindspot", label: "Blindspot" },
  { href: "/glossary", label: "Glossary" },
  { href: "/pricing", label: "Membership" },
]

export function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [topicsOpen, setTopicsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)
  const topicsRef = useRef<HTMLDivElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)
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
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect -- close overlays on route change */
  useEffect(() => {
    setMobileOpen(false)
    setTopicsOpen(false)
    setAccountOpen(false)
  }, [pathname])
  /* eslint-enable react-hooks/set-state-in-effect */

  const closeMobileMenu = useCallback(() => {
    setMobileOpen(false)
  }, [])

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = ""
      return
    }

    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"

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

  function openMobileMenu() {
    setTopicsOpen(false)
    setAccountOpen(false)
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
          aria-label="Account"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--border)] shrink-0">
            <span className="font-display text-lg font-semibold">Account</span>
            <button
              ref={closeBtnRef}
              type="button"
              className="w-11 h-11 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
              onClick={closeMobileMenu}
              aria-label="Close account menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="px-5 pt-5 pb-6 space-y-5">
              {user ? (
                <div className="space-y-2">
                  <Link
                    href="/account"
                    onClick={closeMobileMenu}
                    className="btn-primary w-full h-11"
                  >
                    Open account
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      handleSignOut()
                      closeMobileMenu()
                    }}
                    className="btn-ghost w-full h-11"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/signup"
                    onClick={closeMobileMenu}
                    className="btn-primary w-full h-11"
                  >
                    Create account
                  </Link>
                  <Link
                    href="/login"
                    onClick={closeMobileMenu}
                    className="btn-ghost w-full h-11"
                  >
                    Sign in
                  </Link>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/pricing"
                  onClick={closeMobileMenu}
                  aria-current={pathname === "/pricing" ? "page" : undefined}
                  className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-3.5 hover:border-[var(--text-secondary)] transition-colors"
                >
                  <span className="block text-[14px] font-semibold text-[var(--text-primary)]">
                    Membership
                  </span>
                  <span className="block mt-1 text-[12px] text-[var(--text-secondary)] leading-snug">
                    Unlock Decode
                  </span>
                </Link>
                <Link
                  href="/donate"
                  onClick={closeMobileMenu}
                  aria-current={pathname === "/donate" ? "page" : undefined}
                  className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-3.5 hover:border-[var(--text-secondary)] transition-colors"
                >
                  <span className="block text-[14px] font-semibold text-[var(--text-primary)]">
                    Donation
                  </span>
                  <span className="block mt-1 text-[12px] text-[var(--text-secondary)] leading-snug">
                    Support the desk
                  </span>
                </Link>
              </div>
            </div>

            <div className="mx-5 border-t border-[var(--border)]" />

            <div className="px-5 pt-5 pb-10">
              <p className="meta-text mb-3">Topics</p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {CATEGORIES.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/topic/${cat.slug}`}
                    onClick={closeMobileMenu}
                    className="px-2 py-2.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--surface-alt)]"
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>
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
          <div className="site-header-brand">
            <button
              type="button"
              className="hamburger-btn"
              onClick={openMobileMenu}
              aria-label="Open account menu"
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
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[320px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-md z-50 p-2 grid grid-cols-2 gap-0.5">
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

          <div className="site-header-actions">
            <LiveSearch />
            <ThemeToggle />
            <div className="relative hidden sm:block" ref={accountRef}>
              {user ? (
                <Link
                  href="/account"
                  className="btn-ghost"
                  aria-label="Account"
                >
                  <UserRound className="h-4 w-4" />
                  Account
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setTopicsOpen(false)
                      setAccountOpen((o) => !o)
                    }}
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                    className="btn-ghost inline-flex items-center gap-1"
                  >
                    <UserRound className="h-4 w-4" />
                    Account
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${accountOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {accountOpen && (
                    <div
                      role="menu"
                      className="absolute top-full right-0 mt-1 w-[220px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-md z-50 p-2 space-y-2"
                    >
                      <Link
                        href="/signup"
                        role="menuitem"
                        onClick={() => setAccountOpen(false)}
                        className="btn-primary w-full h-10"
                      >
                        Create account
                      </Link>
                      <Link
                        href="/login"
                        role="menuitem"
                        onClick={() => setAccountOpen(false)}
                        className="btn-ghost w-full h-10"
                      >
                        Sign in
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
            {user && (
              <button
                type="button"
                onClick={handleSignOut}
                className="btn-ghost hidden lg:inline-flex"
              >
                Sign out
              </button>
            )}
            <Link href="/donate" className="btn-outline hidden lg:inline-flex">
              Donation
            </Link>
          </div>
        </div>
      </header>

      <div id="mobile-site-menu">{mobileDrawer}</div>
    </>
  )
}
