"use client"

import { LegalPageLayout } from "@/components/legal/LegalPageLayout"
import { FadeIn } from "@/components/FadeIn"

const SECTIONS = [
  { id: "our-policy", label: "Our Policy" },
  { id: "filing-notice", label: "Filing a Takedown Notice" },
  { id: "submit-notice", label: "Submit a Notice" },
  { id: "counter-notice", label: "Counter-Notice" },
]

export function DmcaContent() {
  return (
    <LegalPageLayout title="Copyright &amp; Takedown Policy" sections={SECTIONS}>
      <FadeIn>
        <section id="our-policy" className="scroll-mt-[200px]">
          <p>
            Inbound Reporter respects the intellectual property rights of others. We are a news aggregator
            that provides short excerpts, AI-generated summaries, and direct links to original sources.
            We operate in compliance with the{" "}
            <strong>Cambodian Law on Copyright and Related Rights</strong> and applicable international
            copyright conventions, including the Digital Millennium Copyright Act (DMCA) for US-based
            rights holders.
          </p>

          <h2>Our Policy</h2>
          <ul>
            <li>
              We only display brief excerpts and summaries of original content, never full articles
              without attribution.
            </li>
            <li>
              Every story includes a direct link back to the original publisher&apos;s website.
            </li>
            <li>
              We do not host, store, or redistribute copyrighted images, videos, or full-text content
              from third-party sources.
            </li>
            <li>
              Upon receipt of a valid takedown notice, we will promptly remove or disable access to
              the identified content.
            </li>
          </ul>
        </section>
      </FadeIn>

      <FadeIn delay={50}>
        <section id="filing-notice" className="scroll-mt-[200px]">
          <h2>Filing a Takedown Notice</h2>
          <p>
            If you believe that your copyrighted work has been used on Inbound Reporter in a way that
            constitutes infringement, please provide us with the following information in writing:
          </p>
          <ol>
            <li>A physical or electronic signature of the copyright owner or authorized agent.</li>
            <li>Identification of the copyrighted work claimed to have been infringed.</li>
            <li>
              The specific URL(s) on Inbound Reporter where the allegedly infringing material appears.
            </li>
            <li>Your contact information (address, telephone number, and email address).</li>
            <li>
              A statement that you have a good faith belief that the use is not authorized by the
              copyright owner, its agent, or the law.
            </li>
            <li>
              A statement, made under penalty of perjury, that the information in the notice is
              accurate and that you are authorized to act on behalf of the copyright owner.
            </li>
          </ol>
        </section>
      </FadeIn>

      <FadeIn delay={100}>
        <section id="submit-notice" className="scroll-mt-[200px]">
          <h2>Submit a Notice</h2>
          <p>
            Send takedown notices to:
            <br />
            <a href="mailto:inboundcrew82@gmail.com">inboundcrew82@gmail.com</a>
            <br />
            We will acknowledge receipt within 3 business days and take appropriate action within
            7 business days.
          </p>
        </section>
      </FadeIn>

      <FadeIn delay={150}>
        <section id="counter-notice" className="scroll-mt-[200px]">
          <h2>Counter-Notice</h2>
          <p>
            If you believe that material you posted was removed in error, you may send a counter-notice
            including:
          </p>
          <ol>
            <li>Your physical or electronic signature.</li>
            <li>Identification of the material removed and its location before removal.</li>
            <li>
              A statement under penalty of perjury that you have a good faith belief the material was
              removed as a result of mistake or misidentification.
            </li>
            <li>Your name, address, and telephone number, and a statement consenting to the jurisdiction
              of the courts of Phnom Penh, Cambodia.</li>
          </ol>
        </section>
      </FadeIn>
    </LegalPageLayout>
  )
}
