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
              : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 w-full h-full px-0.5 transition-colors ${
                isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="w-full text-[8px] min-[360px]:text-[9px] min-[400px]:text-[9.5px] font-semibold leading-tight tracking-normal text-center truncate px-0.5">
                {t(item.key)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
