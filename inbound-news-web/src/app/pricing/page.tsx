import Link from "next/link"
import { PricingCards } from "@/components/membership/PricingCards"
import { FREE_FEATURES } from "@/lib/plans"

export const metadata = {
  title: "Membership — Inbound Reports",
  description:
    "Keep Inbound Reports independent. Pro unlocks every premium story the moment it's published.",
}

export default function PricingPage() {
  return (
    <div className="container py-10 md:py-14">
      <h1 className="page-title mb-3">Membership</h1>
      <p className="text-[16px] text-[var(--text-secondary)] leading-[1.7] mb-8 max-w-[65ch]">
        Inbound Reports clusters technology coverage so you can read one clear breakdown
        instead of ten scattered posts. Premium stories — the full Decode — are for Pro and
        Premium members. Your membership funds the AI, hosting, and the Telegram digest from
        Phnom Penh.
      </p>

      <PricingCards />

      <div className="mt-10 grid gap-6 md:grid-cols-2 items-stretch">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6">
          <h2 className="font-display text-[16px] font-semibold mb-3">Good to know</h2>
          <ul className="space-y-2 text-[14px] text-[var(--text-secondary)]">
            <li>• Pay by KHQR, then tap I’ve paid — we confirm in the bank app and unlock access.</li>
            <li>• Prefer card? Use Pay with card on a plan — Stripe handles checkout; we never see your card.</li>
            <li>• Already a member? Sign in to read premium stories instantly.</li>
            <li>• Cancel anytime from your account billing portal.</li>
          </ul>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6">
          <h2 className="font-display text-[16px] font-semibold mb-3">Free keeps everything</h2>
          <ul className="space-y-2 text-[14px] text-[var(--text-secondary)]">
            {FREE_FEATURES.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
          <Link
            href="/"
            className="inline-flex mt-5 text-[14px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            Back to the feed →
          </Link>
        </div>
      </div>
    </div>
  )
}
