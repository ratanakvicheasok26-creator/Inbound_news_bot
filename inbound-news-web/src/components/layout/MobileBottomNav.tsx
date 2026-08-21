"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, BookOpen, Eye, GitCompareArrows, Newspaper, Heart } from "lucide-react"
import { useI18n } from "@/lib/i18n/LocaleProvider"

const navItems = [
  { href: "/", icon: Home, key: "nav.home" },
  { href: "/brief", icon: Newspaper, key: "nav.brief" },
  { href: "/compare", icon: GitCompareArrows, key: "nav.compare" },
  { href: "/blindspot", icon: Eye, key: "nav.blindspot" },
  { href: "/glossary", icon: BookOpen, key: "nav.glossary" },
  { href: "/donate", icon: Heart, key: "nav.donate" },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--surface)]"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        minHeight: "var(--mobile-nav-offset)",
      }}
      aria-label="Mobile navigation"
    >
      <div
        className="flex items-center justify-around"
        style={{ height: "var(--mobile-nav-h)" }}
      >
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/glossary"
              ? pathname.startsWith("/glossary") || pathname.startsWith("/concept")
              : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 w-full h-full px-0.5 transition-all ${
                isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 bg-[var(--accent)] rounded-full shadow-[0_1px_4px_rgba(255,0,51,0.5)]" />
              )}
              <item.icon className={`h-4 w-4 shrink-0 transition-transform ${isActive ? "scale-110 font-bold stroke-[2.5]" : ""}`} />
              <span className={`w-full text-[8px] min-[360px]:text-[9px] min-[400px]:text-[9.5px] leading-tight tracking-normal text-center truncate px-0.5 ${isActive ? "font-bold" : "font-medium"}`}>
                {t(item.key)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
