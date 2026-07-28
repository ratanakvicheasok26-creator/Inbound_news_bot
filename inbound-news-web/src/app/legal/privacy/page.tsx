import type { Metadata } from "next"
import { LegalPageLayout } from "@/components/legal/LegalPageLayout"

export const metadata: Metadata = {
  title: "Privacy Policy — Inbound Reporter",
  description: "How Inbound Reporter collects, uses, and protects your information.",
}

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <p>
        This Privacy Policy explains how Inbound Reporter (&quot;we&quot;) collects, uses, and protects your
        information when you use our website.
      </p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li>
          <strong>Optional Account Data:</strong> If you choose to create an account, we collect your
          email address and encrypted password.
        </li>
        <li>
          <strong>Reading Preferences:</strong> We use local storage (browser cookies) to remember your
          preferred language (EN/KH) and reading tier (ELI5, Standard, Deep) so you don&apos;t have to reset
          them on every visit.
        </li>
        <li>
          <strong>Usage Data:</strong> We may automatically collect standard analytics data, such as your
          IP address, browser type, and the pages you visit, to improve our Service.
        </li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To provide and maintain the Service.</li>
        <li>To track your &quot;Digital Literacy Score&quot; (if you opt-in).</li>
        <li>To analyze how users interact with the platform to improve our AI summaries and user interface.</li>
      </ul>

      <h2>3. Third-Party Services</h2>
      <p>
        We utilize the following third-party providers to operate the platform. Your data may be processed
        by them according to their own privacy policies:
      </p>
      <ul>
        <li>
          <strong>Supabase:</strong> For database management and user authentication.
        </li>
        <li>
          <strong>Vercel:</strong> For website hosting and deployment.
        </li>
        <li>
          <strong>AI Providers (Groq, DeepSeek, Gemini):</strong> For processing news text into summaries
          and translations. We do not send your personal data to these providers; we only send article text
          for processing.
        </li>
      </ul>

      <h2>4. Data Retention &amp; Deletion</h2>
      <p>
        You can request the deletion of your account and associated personal data at any time by contacting
        us at{" "}
        <a href="mailto:inboundcrew82@gmail.com">inboundcrew82@gmail.com</a>. Aggregated, anonymized data
        may be retained for analytics.
      </p>

      <h2>5. Khmer Data Protection</h2>
      <p>
        We operate out of Phnom Penh, Cambodia, and align our practices with standard international data
        protection norms. We do not sell your personal data to any third party.
      </p>
    </LegalPageLayout>
  )
}
