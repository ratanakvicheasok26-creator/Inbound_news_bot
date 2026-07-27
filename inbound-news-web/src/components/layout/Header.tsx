"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { CATEGORIES } from "@/lib/categories"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Menu, X, ChevronDown } from "lucide-react"

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

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

  const navLinks = [
    { href: "/blindspot", label: "Blindspot" },
    { href: "/", label: "Timeline" },
    { href: "/glossary", label: "Glossary" },
    { href: "/donate", label: "Donate" },
  ]

  return (
    <>
      <header className="sticky top-0 z-50 border-b-2 border-[var(--text-primary)] bg-[var(--bg)]">
        <div className="container">
          <div className="flex items-center justify-between" style={{ height: "64px" }}>
            <button
              className="flex items-center justify-center w-11 h-11 md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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

            <nav className="hidden md:flex items-center gap-0 ml-8">
              <div className="relative" ref={topicsRef}>
                <button
                  onClick={() => setTopicsOpen(!topicsOpen)}
                  className="flex items-center gap-1 px-4 py-2 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg)] transition-colors"
                >
                  Topics
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${topicsOpen ? "rotate-180" : ""}`} />
                </button>
                {topicsOpen && (
                  <div className="absolute top-full left-0 mt-0 w-[320px] bg-[var(--surface)] border-2 border-[var(--text-primary)] z-50">
                    <div className="grid grid-cols-2 gap-0">
                      {CATEGORIES.map((cat) => (
                        <Link
                          key={cat.slug}
                          href={`/topic/${cat.slug}`}
                          className={`block px-4 py-3 font-mono text-[11px] uppercase tracking-[0.06em] font-medium transition-colors border-b border-[var(--border)] ${
                            pathname === `/topic/${cat.slug}`
                              ? "bg-[var(--text-primary)] text-[var(--bg)]"
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
                  className={`px-4 py-2 font-mono text-[12px] font-bold uppercase tracking-[0.08em] transition-colors ${
                    pathname === link.href
                      ? "bg-[var(--text-primary)] text-[var(--bg)]"
                      : "text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg)]"
                  }`}
                >
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
        </div>
      </header>

      {mobileOpen && (
        <div className="mobile-overlay">
          <button
            className="absolute top-5 right-5 w-11 h-11 flex items-center justify-center"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="mt-12">
            <Link href="/" onClick={() => setMobileOpen(false)}>Home</Link>
            <Link href="/blindspot" onClick={() => setMobileOpen(false)}>Blindspot</Link>
            <Link href="/glossary" onClick={() => setMobileOpen(false)}>Glossary</Link>
            <Link href="/donate" onClick={() => setMobileOpen(false)}>Donate</Link>
          </div>

          <div className="mt-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)] mb-4 font-bold">
              Topics
            </p>
            <div className="grid grid-cols-2 gap-0">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/topic/${cat.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="block px-0 py-3 font-mono text-[11px] uppercase tracking-wider font-medium text-[var(--text-secondary)] border-b border-[var(--border)] hover:text-[var(--text-primary)]"
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
