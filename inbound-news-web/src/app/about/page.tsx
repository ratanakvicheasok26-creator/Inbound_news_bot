import type { Metadata } from "next"
import Link from "next/link"
import { LegalPageLayout } from "@/components/legal/LegalPageLayout"

export const metadata: Metadata = {
  title: "About — Inbound Reporter",
  description: "About Inbound Reporter — bilingual tech news aggregation from Phnom Penh, Cambodia.",
}

export default function AboutPage() {
  return (
    <LegalPageLayout title="About Inbound Reporter">
      <p>
        <strong>Established:</strong> July 2026
        <br />
        <strong>Location:</strong> Phnom Penh, Cambodia
        <br />
        <strong>Founded by:</strong> The Inbound Crew
      </p>

      <h2>Our Mission</h2>
      <p>
        Cambodians consume news primarily through social media algorithms that prioritize hype, outrage, and
        untranslated jargon. Inbound Reporter was built to change that. We are a bilingual (English/Khmer)
        tech news aggregator designed to increase digital literacy, not just feed information.
      </p>

      <h2>What We Do</h2>
      <p>
        We aggregate signals from a dynamically scaling network of over 900 global and regional tech sources.
        Instead of just showing you a headline, we use AI to decode it.
      </p>

      <h2>The &quot;Inbound Crew&quot;</h2>
      <p>
        We are a lean, tech-focused crew operating out of Phnom Penh. We believe that by exposing how the
        media frames tech stories (the Hype-Reality Bar) and explaining the jargon in real-time (the
        Glossary), we can train a generation of Cambodians to think critically about the technology shaping
        their future.
      </p>

      <h2>Support Us</h2>
      <p>
        If you find our platform valuable, consider supporting us via{" "}
        <Link href="/donate">KHQR or ABA</Link>. Your support helps us cover server and AI API costs to
        keep the platform free for everyone.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:inboundcrew82@gmail.com">inboundcrew82@gmail.com</a>
      </p>
    </LegalPageLayout>
  )
}
