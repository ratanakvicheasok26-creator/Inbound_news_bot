import Link from "next/link"
import Image from "next/image"
import { CATEGORIES } from "@/lib/categories"

export function Footer() {
  return (
    <footer className="border-t-2 border-[var(--text-primary)]">
      {/* Massive headline */}
      <div className="overflow-hidden py-12 md:py-20">
        <h2 className="text-[64px] md:text-[96px] lg:text-[120px] font-extrabold leading-[0.85] tracking-[-0.04em] text-[var(--accent)] whitespace-nowrap">
          DECODE THE TECH.
        </h2>
      </div>

      <div className="container pb-12">
        <div className="footer-grid">
          <div>
            <Link href="/" className="flex items-center mb-4">
              <Image src="/logo-dark.png" alt="Inbound Reports" width={1983} height={467} className="block h-[28px] w-auto dark:hidden" />
              <Image src="/logo-light.png" alt="Inbound Reports" width={1982} height={467} className="hidden h-[28px] w-auto dark:block" />
            </Link>
            <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed max-w-[280px]">
              Independent technology journalism, published from Phnom Penh, Cambodia.
              15 RSS feeds monitored 24/7.
            </p>
            <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold">
              Last updated: July 2026
            </div>
          </div>

          <div>
            <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--text-primary)]">
              Sections
            </h4>
            <ul className="space-y-1.5">
              {CATEGORIES.slice(0, 8).map((cat) => (
                <li key={cat.slug}>
                  <Link href={`/topic/${cat.slug}`} className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--text-primary)]">
              Platform
            </h4>
            <ul className="space-y-1.5 text-[13px]">
              <li><Link href="/blindspot" className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Blindspot Feed</Link></li>
              <li><Link href="/glossary" className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Tech Glossary</Link></li>
              <li><Link href="/donate" className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Support Us</Link></li>
              <li><span className="text-[var(--text-secondary)]">Methodology</span></li>
              <li><span className="text-[var(--text-secondary)]">About</span></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--text-primary)]">
              Transparency
            </h4>
            <ul className="space-y-1.5 text-[13px] text-[var(--text-secondary)]">
              <li>All stories link to originals</li>
              <li>AI summaries are marked</li>
              <li>Trust scores per source</li>
              <li>Blindspot detection</li>
            </ul>
            <div className="mt-4">
              <Link
                href="https://t.me/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[var(--accent)] font-bold hover:text-[var(--red-hover)] transition-colors"
              >
                Telegram Bot
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                Subscribe
              </Link>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} Inbound Reports. Built by the Inbound crew.</span>
          <span>AI-processed. Human-reviewed. Always sourced.</span>
        </div>
      </div>
    </footer>
  )
}
