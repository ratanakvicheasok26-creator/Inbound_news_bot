import Image from "next/image"
import { Heart } from "lucide-react"
import { AdBand } from "@/components/ads/AdBand"
import { pickSponsorFrom } from "@/lib/sponsors"
import { getActiveSponsors } from "@/lib/sponsors-server"

export default async function DonatePage() {
  const { sponsors } = await getActiveSponsors()
  const donateAd = pickSponsorFrom("donate", sponsors)

  return (
    <div className="container container-sm py-10 md:py-14">
      <h1 className="page-title mb-3">Donation</h1>
      <p className="text-[16px] text-[var(--text-secondary)] leading-[1.7] mb-10 max-w-[65ch]">
        Inbound Reports stays free so digital literacy tools — clustering, glossary,
        ELI5 tiers, and Local Lens — keep running from Phnom Penh. Donations
        cover AI, hosting, and the Telegram digest.
      </p>

      <div className="grid gap-6 md:grid-cols-2 items-start">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 sm:p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Heart className="h-4 w-4 text-[var(--accent)]" />
            <span className="meta-text">KHQR donation</span>
          </div>

          <a
            href="https://pay.ababank.com/oRF8/puropy03"
            target="_blank"
            rel="noopener noreferrer"
            className="relative block w-full max-w-[220px] aspect-square mx-auto mb-6 bg-[var(--surface)] p-2 transition-opacity hover:opacity-80"
          >
            <Image
              src="/khqr.png"
              alt="KHQR Donation Code"
              fill
              className="object-contain"
              priority
            />
          </a>

          <p className="text-[14px] text-[var(--text-secondary)] mb-1">
            Scan with any KHQR-compatible app
          </p>
          <p className="text-[13px] text-[var(--text-secondary)]">ABA Bank · Inbound Crew</p>
        </div>

        <div>
          <div className="section-header">
            <h2 className="section-title">What your donation covers</h2>
          </div>
          <ul className="space-y-3 text-[14px] text-[var(--text-secondary)]">
            {[
              "AI API costs for summarization and classification",
              "RSS and API ingestion infrastructure",
              "Supabase storage for clustered stories",
              "Telegram bot hosting and digest broadcast",
              "Domain, CDN, and deployment costs",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-[var(--accent)] mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {donateAd && (
        <AdBand
          placement="donate"
          flush
          creative={donateAd}
          sponsors={sponsors}
        />
      )}
    </div>
  )
}
