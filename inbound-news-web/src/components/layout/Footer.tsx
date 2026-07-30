import Link from "next/link"
import Image from "next/image"
import { CATEGORIES } from "@/lib/categories"

export function Footer() {
  return (
    <footer className="border-t-2 border-[var(--text-primary)]">
      {/* Massive headline */}
      <div className="overflow-hidden py-12 md:py-20">
        <h2 className="text-[max(7vw,32px)] sm:text-[64px] md:text-[96px] lg:text-[120px] font-extrabold leading-[0.85] tracking-[-0.04em] text-[var(--accent)] whitespace-nowrap">
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
            <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed max-w-[280px] md:max-w-none">
              Independent technology journalism, published from Phnom Penh, Cambodia.
              Aggregating from a dynamically scaling network of 900+ tech sources.
            </p>
            <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold">
              Last updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </div>
          </div>

          <div>
            <h4 className="mb-2 font-mono text-[10px] uppercase tracking-[0.06em] font-bold text-[var(--accent)] border-b border-[var(--accent)] pb-1">
              Sections
            </h4>
            <ul className="space-y-1.5">
              {CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link href={`/topic/${cat.slug}`} className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-2 font-mono text-[10px] uppercase tracking-[0.06em] font-bold text-[var(--accent)] border-b border-[var(--accent)] pb-1">
              Platform
            </h4>
            <ul className="space-y-1.5 text-[13px]">
              <li><Link href="/blindspot" className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Blindspot Feed</Link></li>
              <li><Link href="/glossary" className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Tech Glossary</Link></li>
              <li><Link href="/donate" className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Support Us</Link></li>
              <li><Link href="/legal/methodology" className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">AI & Editorial Methodology</Link></li>
              <li><Link href="/about" className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">About Us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-2 font-mono text-[10px] uppercase tracking-[0.06em] font-bold text-[var(--accent)] border-b border-[var(--accent)] pb-1">
              Legal &amp; Trust
            </h4>
            <ul className="space-y-1.5 text-[13px]">
              <li><Link href="/legal/terms" className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Terms of Service</Link></li>
              <li><Link href="/legal/privacy" className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Privacy Policy</Link></li>
              <li><Link href="/legal/dmca" className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">DMCA / Copyright</Link></li>
            </ul>
            {/* Connect with us */}
            <h4 className="mb-2 mt-6 font-mono text-[10px] uppercase tracking-[0.06em] font-bold text-[var(--accent)] border-b border-[var(--accent)] pb-1">
              Connect with us
            </h4>
            <ul className="space-y-1.5 text-[13px]">
              <li><a href="https://t.me/+n3p4DMJ5mspmMGE1" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Telegram (English)</a></li>
              <li><a href="https://t.me/+XGZesNq7wqsxYWE1" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Telegram (Khmer)</a></li>
              <li><a href="https://x.com/inboundcrewm?s=11" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">X / Twitter</a></li>
              <li><a href="https://www.facebook.com/share/1997c4rkNs/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Facebook</a></li>
              <li><a href="mailto:inboundcrew82@gmail.com" className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">inboundcrew82@gmail.com</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} Inbound Reports. Built by the Inbound Crew.</span>
          <span>AI-processed. Human-reviewed. Always sourced.</span>
        </div>
      </div>
    </footer>
  )
}
