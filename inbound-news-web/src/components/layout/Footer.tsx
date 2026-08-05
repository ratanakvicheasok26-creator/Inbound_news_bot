import Link from "next/link"
import Image from "next/image"
import { Mail } from "lucide-react"
import { CATEGORIES } from "@/lib/categories"

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

const COMPANY_LINKS = [
  { href: "/about", label: "About" },
  { href: "/legal/methodology", label: "Methodology" },
  { href: "/donate", label: "Donation" },
]

const HELP_LINKS = [
  { href: "/brief", label: "Daily Brief" },
  { href: "/glossary", label: "Glossary" },
  { href: "/search", label: "Search" },
  { href: "mailto:inboundcrew82@gmail.com", label: "Contact" },
]

const SOCIAL_LINKS = [
  { href: "https://t.me/+n3p4DMJ5mspmMGE1", label: "Telegram (EN)", icon: TelegramIcon, badge: "EN" },
  { href: "https://t.me/+XGZesNq7wqsxYWE1", label: "Telegram (KH)", icon: TelegramIcon, badge: "KH" },
  { href: "https://x.com/inboundcrewm?s=11", label: "X (Twitter)", icon: XIcon },
  { href: "https://www.facebook.com/inboundcrew420", label: "Facebook", icon: FacebookIcon },
  { href: "mailto:inboundcrew82@gmail.com", label: "Email", icon: Mail },
  
]

const LEGAL_LINKS = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/dmca", label: "DMCA" },
]

const linkClass =
  "text-[14px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"

export function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-brand">
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
            <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-[360px]">
              Tech news aggregation from Phnom Penh. We cluster sources and
              explain jargon so readers can decode coverage — not chase hype.
            </p>
          </div>

          <div className="footer-social">
            {SOCIAL_LINKS.map(({ href, label, icon: Icon, badge }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
                {badge ? <span className="footer-social-badge">{badge}</span> : null}
              </a>
            ))}
          </div>
        </div>

        <div className="footer-grid">
          <div className="footer-col-topics">
            <h4 className="meta-text text-[var(--text-primary)] mb-3">Topics</h4>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
              {CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link href={`/topic/${cat.slug}`} className={linkClass}>
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="meta-text text-[var(--text-primary)] mb-3">Company</h4>
            <ul className="space-y-2">
              {COMPANY_LINKS.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className={linkClass}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="meta-text text-[var(--text-primary)] mb-3">Help</h4>
            <ul className="space-y-2">
              {HELP_LINKS.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className={linkClass}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} Inbound Reports</span>
          <nav className="footer-legal" aria-label="Legal">
            {LEGAL_LINKS.map(({ href, label }) => (
              <Link key={label} href={href} className={linkClass}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
