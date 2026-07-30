"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search, BookOpen, User } from "lucide-react"

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/glossary", icon: BookOpen, label: "Glossary" },
  { href: "/account", icon: User, label: "Account" },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t-2 border-[var(--text-primary)] bg-[var(--bg)]" style={{ height: "48px" }}>
      <div className="flex items-center justify-around h-full">
        {navItems.map((item) => {
          const isActive = pathname === item.href
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
              <span className="font-mono text-[10px] uppercase tracking-wider font-bold">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
