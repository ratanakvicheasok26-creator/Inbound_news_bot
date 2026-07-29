"use client"

import { useState } from "react"
import Link from "next/link"
import { FadeIn } from "@/components/FadeIn"
import { useActiveSection } from "@/hooks/useActiveSection"
import {
  ArrowLeft,
  User,
  Sliders,
  Activity,
  Ban,
  MapPin,
  CreditCard,
  Database,
  Server,
  Cpu,
  Clock,
  CheckCircle,
  Mail,
  ChevronDown,
  Menu,
} from "lucide-react"

const SECTIONS = [
  { id: "info-collect", label: "Information We Collect" },
  { id: "info-not-collect", label: "Information We Do Not Collect" },
  { id: "how-we-use", label: "How We Use Your Information" },
  { id: "third-party", label: "Third-Party Services" },
  { id: "data-retention", label: "Data Retention" },
  { id: "data-security", label: "Data Security" },
  { id: "your-rights", label: "Your Rights" },
  { id: "transfers", label: "International Data Transfers" },
  { id: "children", label: "Children" },
  { id: "changes", label: "Changes to This Policy" },
  { id: "contact", label: "Contact" },
]

const SECTION_IDS = SECTIONS.map((s) => s.id)

interface CardItemProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}

function CardItem({ icon, title, children }: CardItemProps) {
  return (
    <div className="group border border-[var(--border)] rounded-xl p-5 md:p-6 bg-[var(--surface)] transition-all duration-200 hover:shadow-lg hover:border-[var(--text-secondary)] hover:-translate-y-0.5">
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-[var(--surface-alt)] flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition-colors duration-200">
          {icon}
        </div>
        <div className="min-w-0">
          <strong className="block text-[16px] font-semibold text-[var(--text-primary)] mb-0.5">{title}</strong>
          <span className="text-[16px] leading-relaxed text-[var(--text-secondary)]">{children}</span>
        </div>
      </div>
    </div>
  )
}

interface InfoBoxProps {
  children: React.ReactNode
}

function InfoBox({ children }: InfoBoxProps) {
  return (
    <div className="border-l-4 border-[var(--accent)] bg-[var(--surface-alt)] rounded-r-xl px-5 py-4 text-[16px] leading-relaxed text-[var(--text-secondary)]">
      {children}
    </div>
  )
}

export function PrivacyPolicyContent() {
  const [mobileTocOpen, setMobileTocOpen] = useState(false)
  const activeSection = useActiveSection(SECTION_IDS)

  return (
    <div className="relative min-h-screen bg-[var(--bg)]">
      <div className="max-w-[860px] mx-auto px-5 md:px-10 py-10 md:py-16">
        {/* Back link */}
        <Link
          href="/legal/terms"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors mb-8"
        >
          <ArrowLeft className="h-3 w-3" />
          Legal &amp; Trust
        </Link>

        {/* Header */}
        <div className="mb-12">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--accent)] font-bold">
            Privacy &amp; Data
          </span>
          <h1 className="page-title mt-2">
            Privacy Policy
          </h1>
          <p className="text-[16px] leading-relaxed text-[var(--text-secondary)] mt-3 max-w-[640px]">
            How Inbound Reports handles your information when you use our website and services.
          </p>
          <div className="flex items-center gap-3 mt-6 pb-8 border-b border-[var(--border)]">
            <Clock className="h-4 w-4 text-[var(--text-secondary)]" />
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary)] font-medium">
              Last Updated: July 29, 2026
            </span>
          </div>
        </div>

        {/* Mobile ToC */}
        <div className="md:hidden mb-8">
          <button
            onClick={() => setMobileTocOpen(!mobileTocOpen)}
            className="w-full flex items-center justify-between border border-[var(--border)] rounded-lg px-4 py-3 bg-[var(--surface)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Menu className="h-4 w-4" />
              On this page
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${mobileTocOpen ? "rotate-180" : ""}`} />
          </button>
          {mobileTocOpen && (
            <nav className="mt-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] overflow-hidden">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={() => setMobileTocOpen(false)}
                  className={`block px-4 py-2.5 text-sm border-b border-[var(--border)] last:border-0 transition-colors ${
                    activeSection === s.id
                      ? "text-[var(--accent)] font-semibold bg-[var(--surface-alt)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
                  }`}
                >
                  {s.label}
                </a>
              ))}
            </nav>
          )}
        </div>

        {/* Desktop Layout: Content + ToC */}
        <div className="flex gap-10">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Intro */}
            <FadeIn>
              <p className="text-[16px] leading-[1.8] text-[var(--text-secondary)] mb-12">
                <strong className="text-[var(--text-primary)]">Inbound Reports</strong> (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
                is committed to protecting your privacy. This Privacy Policy explains how we collect,
                use, store, and safeguard your information when you use our website and services. We
                operate from Phnom Penh, Cambodia, and align our practices with internationally
                recognized data protection principles.
              </p>
            </FadeIn>

            {/* Section 1 */}
            <FadeIn delay={50}>
              <section id="info-collect" className="mb-12 scroll-mt-[200px]">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-primary)] border-b border-[var(--text-primary)] pb-2 mt-2 mb-6">
                  1. Information We Collect
                </h2>
                <p className="text-[16px] text-[var(--text-secondary)] mb-5">
                  We collect only the minimum information necessary to operate the Service:
                </p>
                <div className="space-y-3">
                  <CardItem icon={<User className="h-5 w-5" />} title="Account Data (optional).">
                    If you register for an account, we collect
                    your email address and a securely hashed password via Supabase, our authentication
                    provider. We do not have access to your plain-text password.
                  </CardItem>
                  <CardItem icon={<Sliders className="h-5 w-5" />} title="Local Preferences.">
                    Your language preference, reading tier, theme
                    choice, and bookmarked stories are stored in your browser&apos;s local storage.
                    This data remains on your device and is not transmitted to our servers unless you
                    opt to sync it to your account.
                  </CardItem>
                  <CardItem icon={<Activity className="h-5 w-5" />} title="Reading Activity (optional).">
                    If you opt into digital literacy
                    tracking, anonymized reading activity — story views, tier switches, and jargon
                    lookups — is stored locally to calculate your literacy score. This data is synced
                    to your account only when you are logged in.
                  </CardItem>
                </div>
              </section>
            </FadeIn>

            {/* Section 2 */}
            <FadeIn delay={100}>
              <section id="info-not-collect" className="mb-12 scroll-mt-[200px]">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-primary)] border-b border-[var(--text-primary)] pb-2 mt-2 mb-6">
                  2. Information We Do Not Collect
                </h2>
                <div className="space-y-3 mt-5">
                  <CardItem icon={<Ban className="h-5 w-5" />} title="No IP tracking.">
                    IP addresses for tracking or analytics purposes.
                  </CardItem>
                  <CardItem icon={<Ban className="h-5 w-5" />} title="No tracking cookies.">
                    Tracking cookies, browser fingerprints, or persistent identifiers.
                  </CardItem>
                  <CardItem icon={<MapPin className="h-5 w-5" />} title="No location data.">
                    Location data, contact lists, or device information.
                  </CardItem>
                  <CardItem icon={<CreditCard className="h-5 w-5" />} title="No financial data.">
                    Payment details — donations are processed via external payment links (KHQR/ABA),
                    and we do not receive or store any financial information.
                  </CardItem>
                </div>
              </section>
            </FadeIn>

            {/* Section 3 */}
            <FadeIn delay={150}>
              <section id="how-we-use" className="mb-12 scroll-mt-[200px]">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-primary)] border-b border-[var(--text-primary)] pb-2 mt-2 mb-6">
                  3. How We Use Your Information
                </h2>
                <ul className="space-y-2 mt-5">
                  {[
                    "To provide, maintain, and improve the Service.",
                    "To personalize your experience (language, reading tier, theme).",
                    "To calculate your Digital Literacy Score (if opted in).",
                    "To communicate with you regarding your account or support requests.",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-[16px] leading-relaxed text-[var(--text-secondary)]">
                      <CheckCircle className="h-5 w-5 text-[var(--accent)] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <InfoBox>
                  We do not sell, rent, or share your personal information with third parties for
                  their own use. We do not serve advertisements.
                </InfoBox>
              </section>
            </FadeIn>

            {/* Section 4 */}
            <FadeIn delay={200}>
              <section id="third-party" className="mb-12 scroll-mt-[200px]">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-primary)] border-b border-[var(--text-primary)] pb-2 mt-2 mb-6">
                  4. Third-Party Services
                </h2>
                <p className="text-[16px] text-[var(--text-secondary)] mb-5">
                  The following third-party providers process data as necessary to operate the Service.
                  Each is contractually bound to use data only for the purposes we specify:
                </p>
                <div className="space-y-3">
                  <CardItem icon={<Database className="h-5 w-5" />} title="Supabase (USA).">
                    Database hosting and user authentication. Stores
                    account credentials and synced preferences. Supabase complies with SOC 2 and GDPR
                    standards. Privacy Policy: supabase.com/privacy
                  </CardItem>
                  <CardItem icon={<Server className="h-5 w-5" />} title="Cloud Hosting.">
                    Our website and bot infrastructure are hosted on
                    Railway and Vercel. Temporary server logs may be generated but are not accessed
                    for analytics.
                  </CardItem>
                  <CardItem icon={<Cpu className="h-5 w-5" />} title="AI Providers (Groq, OpenRouter, Google Gemini).">
                    Article text is
                    sent to these providers for AI processing. No personal information, account data,
                    or identifying information is included in these requests — only the public article
                    content and headlines.
                  </CardItem>
                </div>
              </section>
            </FadeIn>

            {/* Section 5 */}
            <FadeIn delay={250}>
              <section id="data-retention" className="mb-12 scroll-mt-[200px]">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-primary)] border-b border-[var(--text-primary)] pb-2 mt-2 mb-6">
                  5. Data Retention
                </h2>
                <p className="text-[16px] leading-[1.8] text-[var(--text-secondary)]">
                  We retain your account data for as long as your account is active. You may request
                  deletion of your account and associated data at any time by contacting us at{" "}
                  <a href="mailto:inboundcrew82@gmail.com" className="text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent)] transition-colors">
                    inboundcrew82@gmail.com
                  </a>. Upon deletion,
                  your email, preferences, and reading history will be removed from our database within
                  14 days. Anonymized, aggregated data that cannot be linked to you may be retained for
                  operational analysis. Local storage data can be cleared at any time via your browser
                  settings.
                </p>
              </section>
            </FadeIn>

            {/* Section 6 */}
            <FadeIn delay={300}>
              <section id="data-security" className="mb-12 scroll-mt-[200px]">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-primary)] border-b border-[var(--text-primary)] pb-2 mt-2 mb-6">
                  6. Data Security
                </h2>
                <p className="text-[16px] leading-[1.8] text-[var(--text-secondary)]">
                  We implement reasonable technical and organizational measures to protect your data,
                  including encryption in transit (TLS 1.3) and at rest (AES-256). Passwords are hashed
                  using bcrypt via Supabase Auth. However, no method of electronic storage or transmission
                  is completely secure, and we cannot guarantee absolute security.
                </p>
              </section>
            </FadeIn>

            {/* Section 7 */}
            <FadeIn delay={350}>
              <section id="your-rights" className="mb-12 scroll-mt-[200px]">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-primary)] border-b border-[var(--text-primary)] pb-2 mt-2 mb-6">
                  7. Your Rights
                </h2>
                <p className="text-[16px] text-[var(--text-secondary)] mb-4">You have the right to:</p>
                <ul className="space-y-2">
                  {[
                    "Access the personal data we hold about you.",
                    "Request correction or deletion of your data.",
                    "Withdraw consent for data processing where applicable.",
                    "Export your data in a portable format.",
                    "Lodge a complaint with applicable data protection authorities.",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-[16px] leading-relaxed text-[var(--text-secondary)]">
                      <CheckCircle className="h-5 w-5 text-[var(--accent)] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[16px] leading-[1.8] text-[var(--text-secondary)]">
                  To exercise these rights, contact us at{" "}
                  <a href="mailto:inboundcrew82@gmail.com" className="text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent)] transition-colors">
                    inboundcrew82@gmail.com
                  </a>. We will respond within 30 days.
                </p>
              </section>
            </FadeIn>

            {/* Section 8 */}
            <FadeIn delay={400}>
              <section id="transfers" className="mb-12 scroll-mt-[200px]">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-primary)] border-b border-[var(--text-primary)] pb-2 mt-2 mb-6">
                  8. International Data Transfers
                </h2>
                <p className="text-[16px] leading-[1.8] text-[var(--text-secondary)]">
                  By using the Service, you acknowledge that your data may be processed in Cambodia and
                  in the jurisdictions where our third-party providers operate (including the United
                  States and the European Union). We take steps to ensure that any data transferred
                  receives an adequate level of protection consistent with this policy.
                </p>
              </section>
            </FadeIn>

            {/* Section 9 */}
            <FadeIn delay={450}>
              <section id="children" className="mb-12 scroll-mt-[200px]">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-primary)] border-b border-[var(--text-primary)] pb-2 mt-2 mb-6">
                  9. Children&apos;s Privacy
                </h2>
                <p className="text-[16px] leading-[1.8] text-[var(--text-secondary)]">
                  The Service is not directed at individuals under 13 years of age. We do not knowingly
                  collect personal data from children. If we become aware that a child has provided us
                  with personal data, we will delete it promptly. If you believe a child has submitted
                  data to us, please contact us.
                </p>
              </section>
            </FadeIn>

            {/* Section 10 */}
            <FadeIn delay={500}>
              <section id="changes" className="mb-12 scroll-mt-[200px]">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-primary)] border-b border-[var(--text-primary)] pb-2 mt-2 mb-6">
                  10. Changes to This Policy
                </h2>
                <p className="text-[16px] leading-[1.8] text-[var(--text-secondary)]">
                  We may update this Privacy Policy from time to time. Changes will be posted on this
                  page with an updated &quot;Last Updated&quot; date. Material changes will be
                  communicated via a notice on the website.
                </p>
              </section>
            </FadeIn>

            {/* Section 11 */}
            <FadeIn delay={550}>
              <section id="contact" className="mb-12 scroll-mt-[200px]">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-primary)] border-b border-[var(--text-primary)] pb-2 mt-2 mb-6">
                  11. Contact
                </h2>
                <div className="p-5 md:p-6 border border-[var(--border)] rounded-xl bg-[var(--surface)]">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[var(--surface-alt)] flex items-center justify-center text-[var(--accent)] shrink-0">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[16px] leading-relaxed text-[var(--text-secondary)]">
                        For privacy-related inquiries, data requests, or concerns:{" "}
                        <a href="mailto:inboundcrew82@gmail.com" className="text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent)] transition-colors font-medium">
                          inboundcrew82@gmail.com
                        </a>
                      </p>
                      <p className="text-[16px] text-[var(--text-secondary)] mt-1">
                        Phnom Penh, Cambodia
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </FadeIn>

            {/* Bottom divider */}
            <div className="border-t border-[var(--border)] pt-8 mt-8">
              <p className="text-[13px] text-[var(--text-secondary)] text-center">
                Inbound Reports &mdash; Independent technology journalism from Phnom Penh, Cambodia.
              </p>
            </div>
          </div>

          {/* Desktop ToC (sticky sidebar) */}
          <aside className="hidden lg:block w-[220px] shrink-0">
            <div className="sticky top-16">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-secondary)] font-bold">
                On this page
              </span>
              <nav className="mt-3 space-y-0.5 border-l border-[var(--border)]">
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={`block pl-4 py-2 text-[13px] leading-snug border-l transition-all ${
                      activeSection === s.id
                        ? "border-[var(--accent)] text-[var(--text-primary)] font-semibold -ml-px"
                        : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)]"
                      }`}
                  >
                    {s.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
