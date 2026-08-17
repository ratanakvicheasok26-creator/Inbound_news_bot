"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { CATEGORIES } from "@/lib/categories"
import { ThemeToggle } from "@/components/ThemeToggle"
import { LiveSearch } from "@/components/layout/LiveSearch"
import { useI18n, LOCALE_KEY } from "@/lib/i18n/LocaleProvider"
import type { Locale } from "@/lib/i18n/dictionaries"
import { Menu, X, ChevronDown, UserRound } from "lucide-react"
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
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
        role="presentation"
        onClick={closeMobileMenu}
      >
        <div
          className="fixed inset-y-0 right-0 w-full max-w-sm bg-neutral-950 border-l border-neutral-800 p-6 flex flex-col justify-between shadow-2xl overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <div className="flex items-center justify-between pb-6 border-b border-neutral-800">
              <Link
                href="/"
                onClick={closeMobileMenu}
                className="font-serif text-2xl tracking-wide text-white"
              >
                Inbound Reports
              </Link>
              <button
                ref={closeBtnRef}
                type="button"
                className="p-2 text-neutral-400 hover:text-white"
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
                  pathname === "/" ? "text-[#FF0030] font-semibold" : "text-neutral-300 hover:text-white"
                }`}
              >
                {t("nav.home")}
              </Link>
              <Link
                href="/brief"
                onClick={closeMobileMenu}
                className={`transition-colors ${
                  pathname.startsWith("/brief")
                    ? "text-[#FF0030] font-semibold"
                    : "text-neutral-300 hover:text-white"
                }`}
              >
                {t("nav.brief")}
              </Link>
              <Link
                href="/pricing"
                onClick={closeMobileMenu}
                className={`transition-colors ${
                  pathname === "/pricing"
                    ? "text-[#FF0030] font-semibold"
                    : "text-neutral-300 hover:text-white"
                }`}
              >
                {t("nav.membership")}
              </Link>

              <div className="pt-2 border-t border-neutral-800/80">
                <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-3">
                  Explore
                </p>
                <div className="flex flex-col space-y-3 pl-2">
                  <Link
                    href="/compare"
                    onClick={closeMobileMenu}
                    className="text-neutral-400 hover:text-white text-sm"
                  >
                    {t("nav.compare")}
                  </Link>
                  <Link
                    href="/blindspot"
                    onClick={closeMobileMenu}
                    className="text-neutral-400 hover:text-white text-sm"
                  >
                    {t("nav.blindspot")}
                  </Link>
                  <Link
                    href="/glossary"
                    onClick={closeMobileMenu}
                    className="text-neutral-400 hover:text-white text-sm"
                  >
                    {t("nav.glossary")}
                  </Link>
                  <Link
                    href="/search"
                    onClick={closeMobileMenu}
                    className="text-neutral-400 hover:text-white text-sm"
                  >
                    {t("nav.topics")}
                  </Link>
                </div>
              </div>
            </nav>
          </div>

          <div className="mt-8 pt-6 border-t border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400">Language</span>
              <div className="flex items-center space-x-2 text-xs font-bold tracking-wider">
                <button
                  type="button"
                  onClick={() => handleLanguage("en")}
                  className={locale === "en" ? "text-[#FF0030]" : "text-neutral-500 hover:text-white"}
                >
                  EN
                </button>
                <span className="text-neutral-700">/</span>
                <button
                  type="button"
                  onClick={() => handleLanguage("km")}
                  className={locale === "km" ? "text-[#FF0030]" : "text-neutral-500 hover:text-white"}
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
                  className="w-full h-10 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 flex items-center justify-center text-sm font-semibold text-white transition-colors"
                >
                  {t("nav.openAccount")}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    handleSignOut()
                    closeMobileMenu()
                  }}
                  className="w-full h-10 rounded-xl bg-transparent border border-neutral-800 hover:bg-neutral-900 flex items-center justify-center text-sm font-semibold text-neutral-400 hover:text-white transition-colors"
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
                  className="w-full h-10 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 flex items-center justify-center text-sm font-semibold text-white transition-colors"
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
      <header className="sticky top-0 z-50 bg-[#121212]/85 backdrop-blur-md border-b border-neutral-800/80 transition-colors">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="md:hidden p-2 text-neutral-400 hover:text-white"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              href="/"
              className="font-serif text-2xl sm:text-3xl tracking-wide text-white hover:text-neutral-300 transition-colors"
            >
              Inbound Reports
            </Link>
          </div>

          {/* Main Navigation (Home, Brief, Membership, Explore dropdown) */}
          <nav className="hidden md:flex items-center space-x-7 text-sm font-medium text-neutral-300">
            <Link
              href="/"
              className={`transition-colors ${
                pathname === "/" ? "text-white font-semibold" : "text-neutral-400 hover:text-white"
              }`}
            >
              {t("nav.home")}
            </Link>

            <Link
              href="/brief"
              className={`transition-colors ${
                pathname.startsWith("/brief")
                  ? "text-white font-semibold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {t("nav.brief")}
            </Link>

            <Link
              href="/pricing"
              className={`transition-colors ${
                pathname === "/pricing"
                  ? "text-white font-semibold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {t("nav.membership")}
            </Link>

            {/* Explore Dropdown */}
            <div className="relative group cursor-pointer" ref={exploreRef}>
              <button
                type="button"
                onClick={() => setExploreOpen((o) => !o)}
                className={`flex items-center transition-colors ${
                  isExploreActive
                    ? "text-white font-semibold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <span>Explore</span>
                <ChevronDown className="w-3.5 h-3.5 ml-1 transition-transform group-hover:rotate-180" />
              </button>

              <div className="absolute left-0 mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto py-2 z-50">
                <Link
                  href="/compare"
                  className="block px-4 py-2 text-xs sm:text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                >
                  {t("nav.compare")}
                </Link>
                <Link
                  href="/blindspot"
                  className="block px-4 py-2 text-xs sm:text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                >
                  {t("nav.blindspot")}
                </Link>
                <Link
                  href="/glossary"
                  className="block px-4 py-2 text-xs sm:text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                >
                  {t("nav.glossary")}
                </Link>
                <Link
                  href="/search"
                  className="block px-4 py-2 text-xs sm:text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                >
                  {t("nav.topics")}
                </Link>
              </div>
            </div>
          </nav>

          {/* Right Actions: Search, Language Toggle, Theme Toggle, Account */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Search */}
            <LiveSearch />

            {/* Language Toggle: EN / KH */}
            <div className="flex items-center space-x-1 text-[11px] font-bold tracking-wider">
              <button
                type="button"
                onClick={() => handleLanguage("en")}
                className={`transition-colors cursor-pointer ${
                  locale === "en" ? "text-[#FF0030]" : "text-neutral-500 hover:text-neutral-200"
                }`}
              >
                EN
              </button>
              <span className="text-neutral-700 select-none">/</span>
              <button
                type="button"
                onClick={() => handleLanguage("km")}
                className={`transition-colors cursor-pointer ${
                  locale === "km" ? "text-[#FF0030]" : "text-neutral-500 hover:text-neutral-200"
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
                  className="flex items-center space-x-1.5 text-sm font-medium text-neutral-300 hover:text-white transition-colors"
                >
                  <UserRound className="w-4 h-4" />
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
                    className="flex items-center space-x-1.5 text-sm font-medium text-neutral-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <UserRound className="w-4 h-4" />
                    <span className="hidden sm:inline">{t("nav.account")}</span>
                  </button>
                  {accountOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-2 space-y-2 z-50">
                      <Link
                        href="/signup"
                        onClick={() => setAccountOpen(false)}
                        className="w-full h-9 rounded-lg bg-[#FF0030] hover:bg-[#FF0030]/90 text-white text-xs font-semibold flex items-center justify-center transition-colors"
                      >
                        {t("nav.createAccount")}
                      </Link>
                      <Link
                        href="/login"
                        onClick={() => setAccountOpen(false)}
                        className="w-full h-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-semibold flex items-center justify-center transition-colors"
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
