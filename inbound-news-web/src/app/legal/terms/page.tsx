import type { Metadata } from "next"
import { LegalPageLayout } from "@/components/legal/LegalPageLayout"

export const metadata: Metadata = {
  title: "Terms of Service — Inbound Reporter",
  description: "Terms of Service for Inbound Reporter, a bilingual tech news aggregator from Phnom Penh, Cambodia.",
}

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service">
      <p>
        Welcome to Inbound Reporter (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By accessing or using
        our website and services (the &quot;Service&quot;), you agree to be bound by these Terms of Service.
        If you do not agree, please do not use the Service.
      </p>

      <h2>1. Nature of the Service (Aggregator &amp; AI)</h2>
      <p>
        Inbound Reporter is a technology news aggregation platform. We do not own the original news
        articles, images, or reports we reference. Our platform provides summaries, translations, and
        analyses of articles sourced from over 900 third-party publications. All summaries, Khmer
        translations, &quot;ELI5&quot; (Explain Like I&apos;m 5) content, and &quot;Hype-Reality&quot; scores are
        generated using Artificial Intelligence (AI) models (including Groq, DeepSeek, and Gemini) and
        may occasionally contain inaccuracies, translation errors, or hallucinated context.
      </p>

      <h2>2. Fair Use &amp; Copyright</h2>
      <p>
        All original content from third-party sources remains the property of its respective owners. We
        operate under the principles of &quot;Fair Use&quot; for the purposes of news commentary, criticism,
        and education. We only display brief snippets/summaries and provide direct links back to the
        original publisher&apos;s website.
      </p>

      <h2>3. Limitation of Liability</h2>
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot; for informational and educational purposes
        only. Inbound Reporter and the Inbound Crew are not liable for any direct, indirect, incidental,
        or consequential damages arising from your reliance on our AI-generated summaries, translations,
        or hype scores. You should always refer to the original source before making financial, business,
        or technical decisions based on our content.
      </p>

      <h2>4. User Accounts &amp; Features</h2>
      <p>
        Account creation is optional. If you choose to create an account to save articles or track your
        digital literacy score, you are responsible for maintaining the confidentiality of your account.
        We reserve the right to suspend accounts that violate these terms.
      </p>

      <h2>5. Donations</h2>
      <p>
        We accept voluntary donations via KHQR and ABA payment links. Donations are non-refundable.
        Making a donation does not grant you any ownership, equity, or special privileges regarding the
        platform.
      </p>

      <h2>6. Changes to Terms</h2>
      <p>
        We reserve the right to modify these Terms at any time. Continued use of the Service after
        changes constitutes acceptance of the new Terms.
      </p>
    </LegalPageLayout>
  )
}
