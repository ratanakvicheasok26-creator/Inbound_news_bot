import type { Metadata } from "next"
import Link from "next/link"
import { LegalPageLayout } from "@/components/legal/LegalPageLayout"

export const metadata: Metadata = {
  title: "About — Inbound Reports",
  description: "About Inbound Reports — tech news aggregation from Phnom Penh, Cambodia.",
}

export default function AboutPage() {
  return (
    <LegalPageLayout title="About Inbound Reports">
      <p>
        <strong>Established:</strong> 2026
        <br />
        <strong>Location:</strong> Phnom Penh, Cambodia
        <br />
        <strong>Founded by:</strong> The Inbound Crew
      </p>

      <h2>What this is</h2>
      <p>
        Inbound Reports is a technology news aggregator based in Phnom Penh — Ground News–style
        coverage mapping for tech people. We cluster related tech stories and show outlet count,
        roles (Booster / Trade / Critical / Community / Research / Corporate), Compare framing, and
        Blindspot undercoverage — plus literacy tools (jargon, reading tiers when copy differs,
        Cambodia Local Lens). See our <Link href="/legal/methodology">methodology</Link> page for
        how each layer works.
      </p>

      <h2>Source network</h2>
      <p>
        We maintain a large curated source registry for Telegram and website ingest. The live site
        shows clustered stories from the website pipeline; not every registered feed appears on
        every page every day.
      </p>

      <h2>AI stack</h2>
      <p>
        Summarization and classification use a multi-provider router: <strong>Groq</strong> as
        primary, <strong>OpenRouter</strong> as fallback, and <strong>Google Gemini</strong> as
        last resort when upstream providers are unavailable. If every provider fails, the bot
        falls back to pre-written template text rather than posting nothing.
      </p>

      <h2>The Inbound Crew</h2>
      <p>
        We are a small tech crew in Phnom Penh. The product exists to increase digital literacy —
        showing multi-source coverage and explaining jargon in context (Glossary) — not to maximize
        engagement.
      </p>

      <h2>Donation</h2>
      <p>
        If the platform is useful, you can help with server and API costs via{" "}
        <Link href="/donate">KHQR or ABA</Link>. The site stays free for readers.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:inboundcrew82@gmail.com">inboundcrew82@gmail.com</a>
      </p>
    </LegalPageLayout>
  )
}
