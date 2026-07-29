import type { Metadata } from "next"
import Link from "next/link"
import { LegalPageLayout } from "@/components/legal/LegalPageLayout"

export const metadata: Metadata = {
  title: "About — Inbound Reports",
  description: "About Inbound Reports — bilingual tech news aggregation from Phnom Penh, Cambodia.",
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
        Inbound Reports is a bilingual (English/Khmer) tech news aggregator based in Phnom Penh.
        We collect stories from a shared source network, cluster related coverage, and present
        concise summaries with literacy tools — jargon highlighting, an ELI5 reading tier, and a
        hype-versus-substance score — so readers can decode tech news instead of only scrolling it.
      </p>

      <h2>Source network</h2>
      <p>
        We run <strong>900+ active global and regional tech sources</strong>, scaling daily.
        Adding a source is as simple as editing a YAML file — no application code or database
        schema changes required.
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
        exposing how stories are framed (Hype-Reality Bar) and explaining jargon in context
        (Glossary) — not to maximize engagement.
      </p>

      <h2>Support</h2>
      <p>
        If the platform is useful, you can support server and API costs via{" "}
        <Link href="/donate">KHQR or ABA</Link>. The site stays free for readers.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:inboundcrew82@gmail.com">inboundcrew82@gmail.com</a>
      </p>
    </LegalPageLayout>
  )
}
