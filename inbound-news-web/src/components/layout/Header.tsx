"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { CATEGORIES } from "@/lib/categories"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Menu, X, ChevronDown, Eye, BookOpen } from "lucide-react"

export function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [topicsOpen, setTopicsOpen] = useState(false)
  const [lang, setLang] = useState<"en" | "km">("en")
  const topicsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (topicsRef.current && !topicsRef.current.contains(e.target as Node)) {
        setTopicsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setTopicsOpen(false)
  }, [pathname])

  const navLinks = [
    { href: "/blindspot", label: "Blindspot", icon: Eye },
    { href: "/", label: "Timeline" },
    { href: "/glossary", label: "Glossary", icon: BookOpen },
    { href: "/donate", label: "Donate" },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]">
      <div className="container">
        <div className="flex items-center justify-between" style={{ height: "64px" }}>
          <button
            className="flex items-center justify-center w-8 h-8 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/" className="flex items-center shrink-0">
            <Image
              src="/logo-light.png"
              alt="Inbound Reports"
              width={180}
              height={40}
              priority
              className="block h-[32px] w-auto dark:hidden"
            />
            <Image
              src="/logo-dark.png"
              alt="Inbound Reports"
              width={180}
              height={40}
              priority
              className="hidden h-[32px] w-auto dark:block"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-8">
            <div className="relative" ref={topicsRef}>
              <button
                onClick={() => setTopicsOpen(!topicsOpen)}
                className="flex items-center gap-1 px-3 py-2 font-sans text-[14px] font-medium text-[var(--text-primary)] hover:text-[var(--red-hover)] transition-colors"
              >
                Topics
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${topicsOpen ? "rotate-180" : ""}`} />
              </button>
              {topicsOpen && (
                <div className="absolute top-full left-0 mt-1 w-[280px] bg-[var(--surface)] border border-[var(--border)] shadow-lg z-50">
                  <div className="grid grid-cols-2 gap-0">
                    {CATEGORIES.map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/topic/${cat.slug}`}
                        className={`block px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors border-b border-[var(--border)] ${
                          pathname === `/topic/${cat.slug}`
                            ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {cat.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1 px-3 py-2 font-sans text-[14px] font-medium transition-colors ${
                  pathname === link.href
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--red-hover)]"
                }`}
              >
                {link.icon && <link.icon className="h-3.5 w-3.5" />}
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="lang-toggle">
              <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
              <button className={lang === "km" ? "active" : ""} onClick={() => setLang("km")}>ខ្មែរ</button>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden pb-4 border-t border-[var(--border)] pt-3">
            <Link href="/" className="block py-2 font-sans text-[14px] font-medium text-[var(--text-primary)]">Home</Link>
            <Link href="/blindspot" className="flex items-center gap-2 py-2 font-sans text-[14px] font-medium text-[var(--text-secondary)]">
              <Eye className="h-3.5 w-3.5" /> Blindspot
            </Link>
            <Link href="/glossary" className="flex items-center gap-2 py-2 font-sans text-[14px] font-medium text-[var(--text-secondary)]">
              <BookOpen className="h-3.5 w-3.5" /> Glossary
            </Link>
            <Link href="/donate" className="block py-2 font-sans text-[14px] font-medium text-[var(--accent)]">Donate</Link>
            <div className="py-2 font-sans text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Topics</div>
            <div className="grid grid-cols-2 gap-0">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/topic/${cat.slug}`}
                  className={`block px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors border-b border-[var(--border)] ${
                    pathname === `/topic/${cat.slug}`
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
