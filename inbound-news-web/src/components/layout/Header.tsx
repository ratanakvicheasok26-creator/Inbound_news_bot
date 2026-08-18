/* eslint-disable react-hooks/set-state-in-effect */
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { ThemeToggle } from "@/components/ThemeToggle"
import { LiveSearch } from "@/components/layout/LiveSearch"
import { useI18n, LOCALE_KEY } from "@/lib/i18n/LocaleProvider"
import type { Locale } from "@/lib/i18n/dictionaries"
import { Menu, X } from "lucide-react"
import { supabase, signOut } from "@/lib/auth"
import type { User } from "@supabase/supabase-js"

export function Header() {
  const { t, locale, setLocale } = useI18n()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [exploreOpen, setExploreOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)
  const exploreRef = useRef<HTMLDivElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exploreRef.current && !exploreRef.current.contains(e.target as Node)) {
        setExploreOpen(false)
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setExploreOpen(false)
    setAccountOpen(false)
  }, [pathname])

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
    const timer = setTimeout(() => closeBtnRef.current?.focus(), 50)

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobileMenu()
    }
    document.addEventListener("keydown", onKey)

    return () => {
      clearTimeout(timer)
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [mobileOpen, closeMobileMenu])

  async function handleSignOut() {
    await signOut()
    setUser(null)
  }

  function handleLanguage(lang: Locale) {
    if (lang === locale) return
    try {
      localStorage.setItem(LOCALE_KEY, lang)
    } catch {
      // ignore
    }
    setLocale(lang)
  }

  const isExploreActive =
    pathname.startsWith("/compare") ||
    pathname.startsWith("/blindspot") ||
    pathname.startsWith("/glossary") ||
    pathname.startsWith("/topic") ||
    pathname.startsWith("/source")

  const mobileDrawer =
    mounted &&
    mobileOpen &&
    createPortal(
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        role="presentation"
        onClick={closeMobileMenu}
      >
        <div
          className="fixed inset-y-0 right-0 w-full max-w-sm bg-[var(--surface)] border-l border-[var(--border)] p-6 flex flex-col justify-between shadow-2xl overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <div className="flex items-center justify-between pb-6 border-b border-[var(--border)]">
              <Link
                href="/"
                onClick={closeMobileMenu}
                className="font-serif text-2xl tracking-wide text-[var(--text-primary)]"
              >
                Inbound Reports
              </Link>
              <button
                ref={closeBtnRef}
                type="button"
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                onClick={closeMobileMenu}
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <nav className="mt-6 flex flex-col space-y-4 text-base font-medium">
              <Link
                href="/"
                onClick={closeMobileMenu}
                className={`transition-colors ${
                  pathname === "/" ? "text-[var(--accent)] font-semibold" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t("nav.home")}
              </Link>
              <Link
                href="/brief"
                onClick={closeMobileMenu}
                className={`transition-colors ${
                  pathname.startsWith("/brief")
                    ? "text-[var(--accent)] font-semibold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t("nav.brief")}
              </Link>
              <Link
                href="/pricing"
                onClick={closeMobileMenu}
                className={`transition-colors ${
                  pathname === "/pricing"
                    ? "text-[var(--accent)] font-semibold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t("nav.membership")}
              </Link>

              <div className="pt-2 border-t border-[var(--border)]">
                <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)] opacity-75 font-semibold mb-3">
                  Explore
                </p>
                <div className="flex flex-col space-y-3 pl-2">
                  <Link
                    href="/compare"
                    onClick={closeMobileMenu}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm"
                  >
                    {t("nav.compare")}
                  </Link>
                  <Link
                    href="/blindspot"
                    onClick={closeMobileMenu}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm"
                  >
                    {t("nav.blindspot")}
                  </Link>
                  <Link
                    href="/glossary"
                    onClick={closeMobileMenu}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm"
                  >
                    {t("nav.glossary")}
                  </Link>
                  <Link
                    href="/search"
                    onClick={closeMobileMenu}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm"
                  >
                    {t("nav.topics")}
                  </Link>
                </div>
              </div>
            </nav>
          </div>

          <div className="mt-8 pt-6 border-t border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Language</span>
              <div className="flex items-center space-x-2 text-xs font-bold tracking-wider">
                <button
                  type="button"
                  onClick={() => handleLanguage("en")}
                  className={locale === "en" ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}
                >
                  EN
                </button>
                <span className="text-[var(--text-secondary)] opacity-40">/</span>
                <button
                  type="button"
                  onClick={() => handleLanguage("km")}
                  className={locale === "km" ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}
                >
                  KH
                </button>
              </div>
            </div>

            {user ? (
              <div className="space-y-2">
                <Link
                  href="/account"
                  onClick={closeMobileMenu}
                  className="w-full h-10 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] hover:bg-[var(--border)] flex items-center justify-center text-sm font-semibold text-[var(--text-primary)] transition-colors"
                >
                  {t("nav.openAccount")}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    handleSignOut()
                    closeMobileMenu()
                  }}
                  className="w-full h-10 rounded-xl bg-transparent border border-[var(--border)] hover:bg-[var(--surface-alt)] flex items-center justify-center text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {t("nav.signOut")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/signup"
                  onClick={closeMobileMenu}
                  className="w-full h-10 rounded-xl bg-[#FF0030] hover:bg-[#FF0030]/90 flex items-center justify-center text-sm font-semibold text-white transition-colors"
                >
                  {t("nav.createAccount")}
                </Link>
                <Link
                  href="/login"
                  onClick={closeMobileMenu}
                  className="w-full h-10 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] hover:bg-[var(--border)] flex items-center justify-center text-sm font-semibold text-[var(--text-primary)] transition-colors"
                >
                  {t("nav.signIn")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    )

  return (
    <>
      <header className="bg-[var(--surface)]/90 backdrop-blur-md sticky top-0 z-50 border-b border-[var(--border)] transition-colors duration-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Logo & Mobile Menu Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              className="md:hidden p-1.5 sm:p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              href="/"
              className="font-serif text-xl sm:text-2xl md:text-3xl tracking-wide text-[var(--text-primary)] hover:text-[var(--accent)] hover-transition truncate"
            >
              Inbound Reports
            </Link>
          </div>

          {/* Main Navigation (Home, Brief, Membership, Explore dropdown) */}
          <nav className="hidden md:flex space-x-5 lg:space-x-6 text-sm font-medium text-[var(--text-secondary)] shrink-0">
            <Link
              href="/"
              className={`hover-transition ${
                pathname === "/" ? "text-[var(--accent)] font-semibold" : "hover:text-[var(--text-primary)]"
              }`}
            >
              {t("nav.home")}
            </Link>

            <Link
              href="/brief"
              className={`hover-transition ${
                pathname.startsWith("/brief")
                  ? "text-[var(--accent)] font-semibold"
                  : "hover:text-[var(--text-primary)]"
              }`}
            >
              {t("nav.brief")}
            </Link>

            <Link
              href="/pricing"
              className={`hover-transition ${
                pathname === "/pricing"
                  ? "text-[var(--accent)] font-semibold"
                  : "hover:text-[var(--text-primary)]"
              }`}
            >
              {t("nav.membership")}
            </Link>

            {/* Explore Dropdown */}
            <div className="relative group cursor-pointer" ref={exploreRef}>
              <span
                onClick={() => setExploreOpen((o) => !o)}
                className={`flex items-center hover:text-[var(--text-primary)] hover-transition ${
                  isExploreActive ? "text-[var(--text-primary)] font-semibold" : ""
                }`}
              >
                <span>{locale === "km" ? "រុករក" : "Explore"}</span>
                <svg
                  className="w-4 h-4 ml-1 transition-transform group-hover:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </span>

              <div
                className={`absolute left-0 mt-2 w-48 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl py-2 z-50 transition-opacity ${
                  exploreOpen
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
                }`}
              >
                <Link
                  href="/compare"
                  className="block px-4 py-2 hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)] text-[var(--text-secondary)] transition-colors"
                >
                  {t("nav.compare")}
                </Link>
                <Link
                  href="/blindspot"
                  className="block px-4 py-2 hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)] text-[var(--text-secondary)] transition-colors"
                >
                  {t("nav.blindspot")}
                </Link>
                <Link
                  href="/glossary"
                  className="block px-4 py-2 hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)] text-[var(--text-secondary)] transition-colors"
                >
                  {t("nav.glossary")}
                </Link>
                <Link
                  href="/search"
                  className="block px-4 py-2 hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)] text-[var(--text-secondary)] transition-colors"
                >
                  {t("nav.topics")}
                </Link>
              </div>
            </div>
          </nav>

          {/* Right Actions: Search, Language Toggle, Theme Toggle, Account */}
          <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 shrink-0">
            {/* Search */}
            <LiveSearch />

            {/* Language Toggle: EN / KH */}
            <div className="flex items-center space-x-1 text-[10px] font-bold tracking-wider">
              <button
                type="button"
                onClick={() => handleLanguage("en")}
                className={`cursor-pointer transition-colors ${
                  locale === "en" ? "text-[var(--accent)] font-extrabold" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                EN
              </button>
              <span className="text-[var(--text-secondary)] opacity-40 select-none">/</span>
              <button
                type="button"
                onClick={() => handleLanguage("km")}
                className={`cursor-pointer transition-colors ${
                  locale === "km" ? "text-[var(--accent)] font-extrabold" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                KH
              </button>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Account */}
            <div className="relative" ref={accountRef}>
              {user ? (
                <Link
                  href="/account"
                  className="flex items-center space-x-1 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                  <span className="hidden sm:inline">{t("nav.account")}</span>
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setExploreOpen(false)
                      setAccountOpen((o) => !o)
                    }}
                    className="flex items-center space-x-1 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                      />
                    </svg>
                    <span className="hidden sm:inline">{t("nav.account")}</span>
                  </button>
                  {accountOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl p-2 space-y-2 z-50">
                      <Link
                        href="/signup"
                        onClick={() => setAccountOpen(false)}
                        className="w-full h-9 rounded-lg bg-[#ff0033] hover:bg-[#b30024] text-white text-xs font-semibold flex items-center justify-center transition-colors shadow-sm"
                      >
                        {t("nav.createAccount")}
                      </Link>
                      <Link
                        href="/login"
                        onClick={() => setAccountOpen(false)}
                        className="w-full h-9 rounded-lg bg-[var(--surface-alt)] hover:bg-[var(--border)] text-[var(--text-primary)] text-xs font-semibold flex items-center justify-center transition-colors border border-[var(--border)]"
                      >
                        {t("nav.signIn")}
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {mobileDrawer}
    </>
  )
}
