/* eslint-disable react-hooks/set-state-in-effect */
"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { ThemeToggle } from "@/components/ThemeToggle"
import { LiveSearch } from "@/components/layout/LiveSearch"
import { PromoBanner } from "@/components/PromoBanner"
import { useI18n, LOCALE_KEY } from "@/lib/i18n/LocaleProvider"
import type { Locale } from "@/lib/i18n/dictionaries"
import { Menu, X } from "lucide-react"
import { signOut, getCurrentUser, type AuthUser } from "@/lib/auth"

export function Header() {
  const { t, locale, setLocale } = useI18n()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [exploreOpen, setExploreOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(true)
  const [headerHeight, setHeaderHeight] = useState<number | null>(null)
  const headerRef = useRef<HTMLElement>(null)
  const exploreRef = useRef<HTMLDivElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!headerRef.current) return
    const updateHeight = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.getBoundingClientRect().height)
      }
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(headerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let lastScrollY = window.scrollY || 0
    let pivotY = lastScrollY
    let scrollingDown = false
    let ticking = false

    const HIDE_THRESHOLD = 10 // px scrolled down from pivot before hiding
    const SHOW_THRESHOLD = 8  // px scrolled up from pivot before showing
    const TOP_ZONE = 40       // always show within this distance from top

    const onScroll = () => {
      if (ticking) return
      ticking = true

      window.requestAnimationFrame(() => {
        const scrollY = Math.max(0, window.scrollY || 0)
        const delta = scrollY - lastScrollY

        // Always show near the top of the page
        if (scrollY <= TOP_ZONE) {
          setVisible(true)
          pivotY = scrollY
          lastScrollY = scrollY
          ticking = false
          return
        }

        // Ignore micro-movements (< 2px) — prevents jitter on mobile
        if (Math.abs(delta) < 2) {
          ticking = false
          return
        }

        // Detect direction change and reset pivot
        if (delta > 0 && !scrollingDown) {
          scrollingDown = true
          pivotY = lastScrollY
        } else if (delta < 0 && scrollingDown) {
          scrollingDown = false
          pivotY = lastScrollY
        }

        const distFromPivot = scrollY - pivotY

        if (scrollingDown && distFromPivot > HIDE_THRESHOLD && scrollY > 50) {
          setVisible(false)
        } else if (!scrollingDown && distFromPivot < -SHOW_THRESHOLD) {
          setVisible(true)
        }

        lastScrollY = scrollY
        ticking = false
      })
    }

    // touchend re-evaluates for iOS momentum scroll that doesn't fire 'scroll'
    const onTouchEnd = () => {
      // Short delay lets the final scroll position settle after momentum
      setTimeout(onScroll, 100)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("touchend", onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("touchend", onTouchEnd)
    }
  }, [])

  useEffect(() => {
    getCurrentUser().then(setUser)
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
    setVisible(true)
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
    pathname.startsWith("/concept") ||
    pathname.startsWith("/topic") ||
    pathname.startsWith("/source") ||
    pathname.startsWith("/search")

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
                className="inline-flex items-center"
              >
                <Image
                  src="/logo-dark.png"
                  alt="Inbound Reports"
                  width={1983}
                  height={467}
                  className="h-8 sm:h-10 w-auto dark:hidden"
                />
                <Image
                  src="/logo-light.png"
                  alt="Inbound Reports"
                  width={2500}
                  height={590}
                  className="hidden h-8 sm:h-10 w-auto dark:block"
                />
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

            <nav className="mt-6 flex flex-col space-y-1.5 text-base font-medium">
              <Link
                href="/"
                onClick={closeMobileMenu}
                aria-current={pathname === "/" ? "page" : undefined}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                  pathname === "/"
                    ? "bg-[var(--accent)]/10 text-[var(--accent)] font-semibold border-l-3 border-[var(--accent)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
                }`}
              >
                <span>{t("nav.home")}</span>
                {pathname === "/" && <span className="w-2 h-2 rounded-full bg-[var(--accent)] ring-4 ring-[var(--accent)]/20" />}
              </Link>
              <Link
                href="/brief"
                onClick={closeMobileMenu}
                aria-current={pathname.startsWith("/brief") ? "page" : undefined}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                  pathname.startsWith("/brief")
                    ? "bg-[var(--accent)]/10 text-[var(--accent)] font-semibold border-l-3 border-[var(--accent)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
                }`}
              >
                <span>{t("nav.brief")}</span>
                {pathname.startsWith("/brief") && <span className="w-2 h-2 rounded-full bg-[var(--accent)] ring-4 ring-[var(--accent)]/20" />}
              </Link>
              <Link
                href="/pricing"
                onClick={closeMobileMenu}
                aria-current={pathname.startsWith("/pricing") ? "page" : undefined}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                  pathname.startsWith("/pricing")
                    ? "bg-[var(--accent)]/10 text-[var(--accent)] font-semibold border-l-3 border-[var(--accent)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
                }`}
              >
                <span>{t("nav.membership")}</span>
                {pathname.startsWith("/pricing") && <span className="w-2 h-2 rounded-full bg-[var(--accent)] ring-4 ring-[var(--accent)]/20" />}
              </Link>

              <div className="pt-3 border-t border-[var(--border)]">
                <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)] opacity-75 font-semibold px-3 mb-2">
                  {t("nav.explore")}
                </p>
                <div className="flex flex-col space-y-1">
                  <Link
                    href="/compare"
                    onClick={closeMobileMenu}
                    aria-current={pathname.startsWith("/compare") ? "page" : undefined}
                    className={`flex items-center justify-between px-3.5 py-2 rounded-xl text-sm transition-all ${
                      pathname.startsWith("/compare")
                        ? "bg-[var(--accent)]/10 text-[var(--accent)] font-semibold border-l-3 border-[var(--accent)] shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
                    }`}
                  >
                    <span>{t("nav.compare")}</span>
                    {pathname.startsWith("/compare") && <span className="w-2 h-2 rounded-full bg-[var(--accent)] ring-4 ring-[var(--accent)]/20" />}
                  </Link>
                  <Link
                    href="/blindspot"
                    onClick={closeMobileMenu}
                    aria-current={pathname.startsWith("/blindspot") ? "page" : undefined}
                    className={`flex items-center justify-between px-3.5 py-2 rounded-xl text-sm transition-all ${
                      pathname.startsWith("/blindspot")
                        ? "bg-[var(--accent)]/10 text-[var(--accent)] font-semibold border-l-3 border-[var(--accent)] shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
                    }`}
                  >
                    <span>{t("nav.blindspot")}</span>
                    {pathname.startsWith("/blindspot") && <span className="w-2 h-2 rounded-full bg-[var(--accent)] ring-4 ring-[var(--accent)]/20" />}
                  </Link>
                  <Link
                    href="/glossary"
                    onClick={closeMobileMenu}
                    aria-current={pathname.startsWith("/glossary") || pathname.startsWith("/concept") ? "page" : undefined}
                    className={`flex items-center justify-between px-3.5 py-2 rounded-xl text-sm transition-all ${
                      pathname.startsWith("/glossary") || pathname.startsWith("/concept")
                        ? "bg-[var(--accent)]/10 text-[var(--accent)] font-semibold border-l-3 border-[var(--accent)] shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
                    }`}
                  >
                    <span>{t("nav.glossary")}</span>
                    {(pathname.startsWith("/glossary") || pathname.startsWith("/concept")) && (
                      <span className="w-2 h-2 rounded-full bg-[var(--accent)] ring-4 ring-[var(--accent)]/20" />
                    )}
                  </Link>
                  <Link
                    href="/search"
                    onClick={closeMobileMenu}
                    aria-current={pathname.startsWith("/search") || pathname.startsWith("/topic") || pathname.startsWith("/source") ? "page" : undefined}
                    className={`flex items-center justify-between px-3.5 py-2 rounded-xl text-sm transition-all ${
                      pathname.startsWith("/search") || pathname.startsWith("/topic") || pathname.startsWith("/source")
                        ? "bg-[var(--accent)]/10 text-[var(--accent)] font-semibold border-l-3 border-[var(--accent)] shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
                    }`}
                  >
                    <span>{t("nav.topics")}</span>
                    {(pathname.startsWith("/search") || pathname.startsWith("/topic") || pathname.startsWith("/source")) && (
                      <span className="w-2 h-2 rounded-full bg-[var(--accent)] ring-4 ring-[var(--accent)]/20" />
                    )}
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
                  className={`w-full h-10 rounded-xl border border-[var(--border)] flex items-center justify-center text-sm font-semibold transition-colors ${
                    pathname.startsWith("/account")
                      ? "bg-[var(--red-subtle-bg)] text-[var(--accent)] border-[var(--accent)]"
                      : "bg-[var(--surface-alt)] text-[var(--text-primary)] hover:bg-[var(--border)]"
                  }`}
                >
                  {t("nav.openAccount")}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu()
                    handleSignOut()
                  }}
                  className="w-full h-10 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-alt)] flex items-center justify-center text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  {t("nav.logout")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/login"
                  onClick={closeMobileMenu}
                  className="w-full h-10 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] hover:bg-[var(--border)] flex items-center justify-center text-sm font-semibold text-[var(--text-primary)] transition-colors"
                >
                  {t("nav.signIn")}
                </Link>
                <Link
                  href="/signup"
                  onClick={closeMobileMenu}
                  className="w-full h-10 rounded-xl bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] flex items-center justify-center text-sm font-semibold transition-colors"
                >
                  {t("nav.createAccount")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    )

  const isHeaderVisible = visible || mobileOpen

  return (
    <>
      <div
        className="smart-header-spacer"
        aria-hidden="true"
        style={
          headerHeight != null
            ? { height: `${headerHeight}px` }
            : undefined
        }
      />
      <header
        ref={headerRef}
        onFocusCapture={() => setVisible(true)}
        className={`smart-header bg-[var(--surface)]/90 backdrop-blur-md border-b border-[var(--border)] ${
          isHeaderVisible ? "smart-header--visible" : "smart-header--hidden"
        }`}
      >
        <PromoBanner />
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
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
              className="inline-flex items-center hover:text-[var(--accent)] hover-transition truncate"
            >
              <Image
                src="/logo-dark.png"
                alt="Inbound Reports"
                width={1983}
                height={467}
                className="h-8 sm:h-10 md:h-12 w-auto dark:hidden"
                priority
              />
              <Image
                src="/logo-light.png"
                alt="Inbound Reports"
                width={2500}
                height={590}
                className="hidden h-8 sm:h-10 md:h-12 w-auto dark:block"
                priority
              />
            </Link>
          </div>

          {/* Main Navigation (Home, Brief, Membership, Explore dropdown) */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 text-sm font-medium text-[var(--text-secondary)] shrink-0">
            <Link
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
              className={`relative px-3 py-1.5 rounded-lg transition-all ${
                pathname === "/"
                  ? "text-[var(--accent)] font-semibold bg-[var(--accent)]/10"
                  : "hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
              }`}
            >
              {t("nav.home")}
              {pathname === "/" && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--accent)] rounded-full" />
              )}
            </Link>

            <Link
              href="/brief"
              aria-current={pathname.startsWith("/brief") ? "page" : undefined}
              className={`relative px-3 py-1.5 rounded-lg transition-all ${
                pathname.startsWith("/brief")
                  ? "text-[var(--accent)] font-semibold bg-[var(--accent)]/10"
                  : "hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
              }`}
            >
              {t("nav.brief")}
              {pathname.startsWith("/brief") && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--accent)] rounded-full" />
              )}
            </Link>

            <Link
              href="/pricing"
              aria-current={pathname.startsWith("/pricing") ? "page" : undefined}
              className={`relative px-3 py-1.5 rounded-lg transition-all ${
                pathname.startsWith("/pricing")
                  ? "text-[var(--accent)] font-semibold bg-[var(--accent)]/10"
                  : "hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
              }`}
            >
              {t("nav.membership")}
              {pathname.startsWith("/pricing") && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--accent)] rounded-full" />
              )}
            </Link>

            {/* Explore Dropdown */}
            <div className="relative group" ref={exploreRef}>
              <button
                type="button"
                onClick={() => setExploreOpen((o) => !o)}
                aria-expanded={exploreOpen}
                aria-current={isExploreActive ? "page" : undefined}
                className={`relative flex items-center px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  isExploreActive
                    ? "text-[var(--accent)] font-semibold bg-[var(--accent)]/10"
                    : "hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
                }`}
              >
                <span>{t("nav.explore")}</span>
                <svg
                  className={`w-4 h-4 ml-1 transition-transform ${exploreOpen ? "rotate-180" : "group-hover:rotate-180"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                {isExploreActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--accent)] rounded-full" />
                )}
              </button>

              <div
                className={`absolute left-0 mt-2 w-52 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl py-2 z-50 transition-opacity ${
                  exploreOpen
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
                }`}
              >
                <Link
                  href="/compare"
                  aria-current={pathname.startsWith("/compare") ? "page" : undefined}
                  className={`flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                    pathname.startsWith("/compare")
                      ? "text-[var(--accent)] font-semibold bg-[var(--accent)]/10"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span>{t("nav.compare")}</span>
                  {pathname.startsWith("/compare") && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
                </Link>
                <Link
                  href="/blindspot"
                  aria-current={pathname.startsWith("/blindspot") ? "page" : undefined}
                  className={`flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                    pathname.startsWith("/blindspot")
                      ? "text-[var(--accent)] font-semibold bg-[var(--accent)]/10"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span>{t("nav.blindspot")}</span>
                  {pathname.startsWith("/blindspot") && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
                </Link>
                <Link
                  href="/glossary"
                  aria-current={pathname.startsWith("/glossary") || pathname.startsWith("/concept") ? "page" : undefined}
                  className={`flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                    pathname.startsWith("/glossary") || pathname.startsWith("/concept")
                      ? "text-[var(--accent)] font-semibold bg-[var(--accent)]/10"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span>{t("nav.glossary")}</span>
                  {(pathname.startsWith("/glossary") || pathname.startsWith("/concept")) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                  )}
                </Link>
                <Link
                  href="/search"
                  aria-current={pathname.startsWith("/search") || pathname.startsWith("/topic") || pathname.startsWith("/source") ? "page" : undefined}
                  className={`flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                    pathname.startsWith("/search") || pathname.startsWith("/topic") || pathname.startsWith("/source")
                      ? "text-[var(--accent)] font-semibold bg-[var(--accent)]/10"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span>{t("nav.topics")}</span>
                  {(pathname.startsWith("/search") || pathname.startsWith("/topic") || pathname.startsWith("/source")) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                  )}
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
                  aria-current={pathname.startsWith("/account") ? "page" : undefined}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    pathname.startsWith("/account")
                      ? "text-[var(--accent)] font-semibold bg-[var(--accent)]/10"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
                  }`}
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
                    aria-expanded={accountOpen}
                    aria-current={pathname === "/login" || pathname === "/signup" ? "page" : undefined}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      pathname === "/login" || pathname === "/signup"
                        ? "text-[var(--accent)] font-semibold bg-[var(--accent)]/10"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
                    }`}
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

      {/* Spacer to compensate for fixed-position header */}
      <div
        className="smart-header-spacer"
        style={headerHeight ? { height: `${headerHeight}px` } : undefined}
      />

      {mobileDrawer}
    </>
  )
}
