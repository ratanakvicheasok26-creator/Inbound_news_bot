import Link from "next/link"
import Image from "next/image"
import { CATEGORIES } from "@/lib/categories"

export function Footer() {
  const topCategories = CATEGORIES.slice(0, 8)

  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link href="/" className="inline-flex items-center mb-4">
              <Image
                src="/logo-dark.png"
                alt="Inbound Reports"
                width={1983}
                height={467}
                className="block h-7 w-auto dark:hidden"
              />
              <Image
                src="/logo-light.png"
                alt="Inbound Reports"
                width={1982}
                height={467}
                className="hidden h-7 w-auto dark:block"
              />
            </Link>
            <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-[320px]">
              Tech news aggregation from Phnom Penh. We cluster sources and
              explain jargon so readers can decode coverage — not chase hype.
            </p>
          </div>

          <div>
            <h4 className="meta-text text-[var(--text-primary)] mb-3">Topics</h4>
            <ul className="space-y-2">
              {topCategories.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`/topic/${cat.slug}`}
                    className="text-[14px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                  >
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="meta-text text-[var(--text-primary)] mb-3">Platform</h4>
            <ul className="space-y-2 text-[14px]">
              <li>
                <Link href="/glossary" className="text-[var(--text-secondary)] hover:text-[var(--accent)]">
                  Glossary
                </Link>
              </li>
              <li>
                <Link href="/search" className="text-[var(--text-secondary)] hover:text-[var(--accent)]">
                  Search
                </Link>
              </li>
              <li>
                <Link href="/donate" className="text-[var(--text-secondary)] hover:text-[var(--accent)]">
                  Donation
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-[var(--text-secondary)] hover:text-[var(--accent)]">
                  About
                </Link>
              </li>
              <li>
                <Link href="/legal/methodology" className="text-[var(--text-secondary)] hover:text-[var(--accent)]">
                  Methodology
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="meta-text text-[var(--text-primary)] mb-3">Connect</h4>
            <ul className="space-y-2 text-[14px]">
              <li>
                <a
                  href="https://t.me/+n3p4DMJ5mspmMGE1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-secondary)] hover:text-[var(--accent)]"
                >
                  Telegram (EN)
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/+XGZesNq7wqsxYWE1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-secondary)] hover:text-[var(--accent)]"
                >
                  Telegram (KM)
                </a>
              </li>
              <li>
                <a
                  href="https://x.com/inboundcrewm?s=11"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-secondary)] hover:text-[var(--accent)]"
                >
                  X / Twitter
                </a>
              </li>
              <li>
                <a
                  href="mailto:inboundcrew82@gmail.com"
                  className="text-[var(--text-secondary)] hover:text-[var(--accent)]"
                >
                  Email
                </a>
              </li>
            </ul>
            <div className="mt-6 space-y-2 text-[13px]">
              <Link href="/legal/terms" className="block text-[var(--text-secondary)] hover:text-[var(--accent)]">
                Terms
              </Link>
              <Link href="/legal/privacy" className="block text-[var(--text-secondary)] hover:text-[var(--accent)]">
                Privacy
              </Link>
              <Link href="/legal/dmca" className="block text-[var(--text-secondary)] hover:text-[var(--accent)]">
                DMCA
              </Link>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} Inbound Reports</span>
          <span>Aggregated. Explained. Always sourced.</span>
        </div>
      </div>
    </footer>
  )
}
