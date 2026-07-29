import Image from "next/image"
import { Heart } from "lucide-react"

export default function DonatePage() {
  return (
    <div className="container">
      <section className="py-10 max-w-[640px] mx-auto">
        <div className="section-header">
          <h1 className="page-title">Support Inbound</h1>
        </div>

        <p className="text-[16px] text-[var(--text-secondary)] leading-[1.7] mb-8 max-w-[65ch]">
          Inbound Reports is independent technology journalism from Phnom Penh.
          We aggregate 900+ tech sources with AI-powered story clustering, and
          zero ad revenue. Your support keeps the wire running.
        </p>

        {/* QR Code */}
        <div className="bg-[var(--surface)] border border-[var(--border)] p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Heart className="h-4 w-4 text-[var(--accent)]" />
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] font-medium text-[var(--text-secondary)]">
              KHQR Donation
            </span>
          </div>

          <a
            href="https://pay.ababank.com/oRF8/puropy03"
            target="_blank"
            rel="noopener noreferrer"
            className="relative block w-full max-w-[240px] aspect-square mx-auto mb-6 bg-[var(--surface)] p-2 transition-opacity hover:opacity-80"
          >
            <Image
              src="/khqr.png"
              alt="KHQR Donation Code"
              fill
              className="object-contain"
              priority
            />
          </a>

          <p className="font-mono text-[12px] text-[var(--text-secondary)] mb-2">
            Scan with any KHQR-compatible app
          </p>
          <p className="font-mono text-[11px] text-[var(--text-secondary)]">
            ABA Bank &middot; Inbound Crew
          </p>
        </div>

        {/* Alternative */}
        <div className="mt-8 pt-6 border-t border-[var(--border)]">
          <div className="section-header">
            <h2 className="section-title">What your support covers</h2>
          </div>
          <ul className="space-y-3 text-[14px] text-[var(--text-secondary)]">
            <li className="flex items-start gap-2">
              <span className="font-mono text-[var(--accent)] mt-0.5">+</span>
              <span>AI API costs (Groq, OpenRouter, Gemini) for story processing</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-mono text-[var(--accent)] mt-0.5">+</span>
              <span>RSS feed ingestion infrastructure</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-mono text-[var(--accent)] mt-0.5">+</span>
              <span>Supabase database for story storage</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-mono text-[var(--accent)] mt-0.5">+</span>
              <span>Telegram bot hosting and broadcast</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-mono text-[var(--accent)] mt-0.5">+</span>
              <span>Domain, CDN, and deployment costs</span>
            </li>
          </ul>
        </div>

        <div className="mt-8 p-4 bg-[var(--surface-alt)] border-l-2 border-[var(--accent)]">
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            <strong className="text-[var(--text-primary)]">Transparent by design.</strong>{" "}
            Every dollar goes to infrastructure. No salaries, no investors, no ads.
            Just the wire, running 24/7 from Phnom Penh.
          </p>
        </div>
      </section>
    </div>
  )
}
