"use client"

import { LegalPageLayout } from "@/components/legal/LegalPageLayout"
import { FadeIn } from "@/components/FadeIn"

const SECTIONS = [
  { id: "service-desc", label: "1. Service Description" },
  { id: "no-advice", label: "2. No Professional Advice" },
  { id: "ai-content", label: "3. AI-Generated Content" },
  { id: "intellectual-property", label: "4. Intellectual Property" },
  { id: "user-accounts", label: "5. User Accounts" },
  { id: "acceptable-use", label: "6. Acceptable Use" },
  { id: "third-party-links", label: "7. Third-Party Links" },
  { id: "donations", label: "8. Donations" },
  { id: "limitation-liability", label: "9. Limitation of Liability" },
  { id: "governing-law", label: "10. Governing Law" },
  { id: "changes-terms", label: "11. Changes to Terms" },
  { id: "contact", label: "12. Contact" },
]

export function TermsContent() {
  return (
    <LegalPageLayout title="Terms of Service" sections={SECTIONS}>
      <FadeIn>
        <p>
          Welcome to <strong>Inbound Reports</strong> (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;),
          operated from Phnom Penh, Cambodia. By accessing or using our website at inboundreports.com
          and any associated services (collectively, the &quot;Service&quot;), you agree to be bound by
          these Terms of Service. If you do not agree to all terms, do not use the Service.
        </p>
      </FadeIn>

      <FadeIn delay={50}>
        <section id="service-desc" className="scroll-mt-[200px]">
          <h2>1. Service Description</h2>
          <p>
            Inbound Reports is a technology news aggregator based in Phnom Penh. We cluster related
            coverage from third-party publications, generate summaries and literacy tools (including
            simplified reading tiers), and link back to original sources. All original article content
            remains the property of its respective owners.
          </p>
        </section>
      </FadeIn>

      <FadeIn delay={100}>
        <section id="no-advice" className="scroll-mt-[200px]">
          <h2>2. No Professional Advice</h2>
          <p>
            Content on this platform is provided for informational and educational purposes only. It
            does not constitute financial, legal, investment, or technical advice. You should
            independently verify any critical information and consult qualified professionals before
            making decisions based on our content. We expressly disclaim any liability for actions
            taken based on content published through the Service.
          </p>
        </section>
      </FadeIn>

      <FadeIn delay={150}>
        <section id="ai-content" className="scroll-mt-[200px]">
          <h2>3. AI-Generated Content</h2>
          <p>
            Portions of the content — including summaries, ELI5 simplifications, Hype-Reality scores,
            and Local Lens analyses — are generated or assisted by third-party AI models accessed via
            Groq, OpenRouter, and Google Gemini. AI-generated content may contain errors, omissions,
            or inaccuracies, including hallucinated facts, dates, or context. We make no guarantee of
            accuracy, completeness, or timeliness of AI-generated content and disclaim all liability
            arising from reliance on it.
          </p>
        </section>
      </FadeIn>

      <FadeIn delay={200}>
        <section id="intellectual-property" className="scroll-mt-[200px]">
          <h2>4. Intellectual Property</h2>
          <p>
            Our aggregation and display of short excerpts and summaries complies with the{" "}
            <strong>Cambodian Law on Copyright and Related Rights</strong> and applicable international
            copyright conventions. All third-party content remains the property of its original
            publishers and is used for the purposes of news aggregation, commentary, and education.
            Each story includes a direct link to the original source. If you believe your copyrighted
            work has been used inappropriately, please refer to our Copyright &amp; Takedown Policy.
          </p>
        </section>
      </FadeIn>

      <FadeIn delay={250}>
        <section id="user-accounts" className="scroll-mt-[200px]">
          <h2>5. User Accounts</h2>
          <p>
            Account creation is optional. If you register, you are responsible for safeguarding your
            credentials and for all activity under your account. You agree to provide accurate
            information and to update it as needed. We reserve the right to suspend or terminate
            accounts that violate these terms or engage in abusive, fraudulent, or illegal activity.
          </p>
        </section>
      </FadeIn>

      <FadeIn delay={300}>
        <section id="acceptable-use" className="scroll-mt-[200px]">
          <h2>6. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose or in violation of Cambodian law.</li>
            <li>Attempt to scrape, crawl, or systematically extract content without prior written consent.</li>
            <li>Interfere with the operation of the Service, including introducing malware or conducting denial-of-service attacks.</li>
            <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity.</li>
          </ul>
        </section>
      </FadeIn>

      <FadeIn delay={350}>
        <section id="third-party-links" className="scroll-mt-[200px]">
          <h2>7. Third-Party Links</h2>
          <p>
            The Service contains links to external websites and resources. We do not control, endorse,
            or assume responsibility for the content, accuracy, legality, or privacy practices of any
            third-party site. Your use of external sites is governed by their own terms and policies.
          </p>
        </section>
      </FadeIn>

      <FadeIn delay={400}>
        <section id="donations" className="scroll-mt-[200px]">
          <h2>8. Donations</h2>
          <p>
            We accept voluntary donations via KHQR and ABA payment links. All donations are
            non-refundable and constitute a voluntary contribution to support infrastructure costs
            (server hosting, AI API usage, domain registration). Donations do not confer ownership,
            equity, membership, or any special privileges regarding the platform or its product
            direction.
          </p>
        </section>
      </FadeIn>

      <FadeIn delay={450}>
        <section id="limitation-liability" className="scroll-mt-[200px]">
          <h2>9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted under the laws of the Kingdom of Cambodia, Inbound Reports
            and the Inbound Crew disclaim all warranties, express or implied, regarding the Service.
            The Service is provided &quot;as is&quot; and &quot;as available.&quot; We are not liable
            for any direct, indirect, incidental, consequential, or punitive damages arising from your
            access to, use of, or inability to use the Service, even if we have been advised of the
            possibility of such damages.
          </p>
        </section>
      </FadeIn>

      <FadeIn delay={500}>
        <section id="governing-law" className="scroll-mt-[200px]">
          <h2>10. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the{" "}
            <strong>Kingdom of Cambodia</strong>. Any dispute arising from these Terms or your use of
            the Service shall be subject to the exclusive jurisdiction of the courts of Phnom Penh,
            Cambodia. You irrevocably submit to the personal jurisdiction of such courts.
          </p>
        </section>
      </FadeIn>

      <FadeIn delay={550}>
        <section id="changes-terms" className="scroll-mt-[200px]">
          <h2>11. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. Changes will be posted on this page
            with an updated &quot;Last Updated&quot; date. Material changes will be communicated via
            a notice on the website. Your continued use of the Service after changes take effect
            constitutes your acceptance of the new Terms.
          </p>
        </section>
      </FadeIn>

      <FadeIn delay={600}>
        <section id="contact" className="scroll-mt-[200px]">
          <h2>12. Contact</h2>
          <p>
            For questions, concerns, or takedown requests, contact us at:{" "}
            <a href="mailto:inboundcrew82@gmail.com">inboundcrew82@gmail.com</a>
            <br />
            Phnom Penh, Cambodia
          </p>
        </section>
      </FadeIn>
    </LegalPageLayout>
  )
}
