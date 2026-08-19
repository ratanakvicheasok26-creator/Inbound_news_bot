import Link from "next/link"
import { PricingCards } from "@/components/membership/PricingCards"
import { LocalizedText } from "@/components/LocalizedText"

export const metadata = {
  title: "Membership — Inbound Reports",
  description:
    "Keep Inbound Reports independent. One membership, billed monthly or yearly.",
}

const FREE_FEATURE_KEYS = [
  "pricing.features.free1",
  "pricing.features.free2",
  "pricing.features.free2b",
  "pricing.features.free3",
  "pricing.features.free4",
  "pricing.features.free5",
]

export default function PricingPage() {
  return (
    <div className="container py-8 sm:py-10 md:py-14">
      <h1 className="page-title mb-3 text-balance">
        <LocalizedText k="pricing.pageTitle" />
      </h1>
      <p className="text-[15px] sm:text-[16px] text-[var(--text-secondary)] leading-[1.7] mb-6 sm:mb-8 max-w-[65ch]">
        <LocalizedText k="pricing.pageSubtitle" />
      </p>

      <PricingCards />

      <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 md:grid-cols-2 items-stretch">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-4 sm:p-6 min-w-0">
          <h2 className="font-display text-[16px] font-semibold mb-3">
            <LocalizedText k="pricing.goodToKnow" />
          </h2>
          <ul className="space-y-2 text-[14px] text-[var(--text-secondary)]">
            <li>
              <LocalizedText k="pricing.payKhqr" />
            </li>
            <li>
              <LocalizedText k="pricing.payCard" />
            </li>
            <li>
              <LocalizedText k="pricing.alreadyMember" />
            </li>
            <li>
              <LocalizedText k="pricing.cancelAnytime" />
            </li>
          </ul>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-4 sm:p-6 min-w-0">
          <h2 className="font-display text-[16px] font-semibold mb-3">
            <LocalizedText k="pricing.freeKeepsEverything" />
          </h2>
          <ul className="space-y-2 text-[14px] text-[var(--text-secondary)]">
            {FREE_FEATURE_KEYS.map((k) => (
              <li key={k}>
                • <LocalizedText k={k} />
              </li>
            ))}
          </ul>
          <Link
            href="/"
            className="inline-flex mt-5 text-[14px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            <LocalizedText k="pricing.backToFeed" /> →
          </Link>
        </div>
      </div>
    </div>
  )
}
