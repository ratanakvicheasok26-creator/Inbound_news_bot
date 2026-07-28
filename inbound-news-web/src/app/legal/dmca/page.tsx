import type { Metadata } from "next"
import { LegalPageLayout } from "@/components/legal/LegalPageLayout"

export const metadata: Metadata = {
  title: "DMCA / Copyright — Inbound Reporter",
  description: "Copyright and DMCA policy for Inbound Reporter.",
}

export default function DmcaPage() {
  return (
    <LegalPageLayout title="DMCA / Copyright Policy">
      <p>
        Inbound Reporter respects the intellectual property rights of others. We are a news aggregator that
        operates under Fair Use, providing AI-generated summaries and direct links to original sources.
      </p>

      <h2>Filing a Copyright Infringement Claim</h2>
      <p>
        If you believe that your copyrighted work has been summarized or linked to in a way that constitutes
        copyright infringement, please provide us with the following information in writing:
      </p>
      <ol>
        <li>A physical or electronic signature of the copyright owner.</li>
        <li>Identification of the copyrighted work claimed to have been infringed.</li>
        <li>
          Identification of the material that is claimed to be infringing (the specific URL on Inbound
          Reporter).
        </li>
        <li>Your contact information, including your address, telephone number, and email.</li>
        <li>
          A statement that you have a good faith belief that use of the material in the manner complained
          of is not authorized by the copyright owner.
        </li>
        <li>
          A statement that the information in the notification is accurate, and under penalty of perjury,
          that you are authorized to act on behalf of the copyright owner.
        </li>
      </ol>

      <h2>Contact for DMCA Notices</h2>
      <p>
        <a href="mailto:inboundcrew82@gmail.com">inboundcrew82@gmail.com</a>
      </p>
    </LegalPageLayout>
  )
}
