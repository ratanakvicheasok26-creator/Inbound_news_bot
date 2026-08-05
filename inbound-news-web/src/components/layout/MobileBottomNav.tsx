"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, BookOpen, Info, LayoutGrid, Newspaper } from "lucide-react"

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/brief", icon: Newspaper, label: "Brief" },
  { href: "/glossary", icon: BookOpen, label: "Glossary" },
  { href: "/about", icon: Info, label: "About" },
]

function openTopicsDrawer() {
  window.dispatchEvent(new CustomEvent("inbound:open-mobile-menu"))
}

export function MobileBottomNav() {
  const pathname = usePathname()

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
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors ${
                isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">{item.label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={openTopicsDrawer}
          aria-label="Open topics"
          className="flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors text-[var(--text-secondary)]"
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">Topics</span>
        </button>
      </div>
    </nav>
  )
}
