import type { Metadata } from "next"
import { TermsContent } from "@/components/legal/TermsContent"

export const metadata: Metadata = {
  title: "Terms of Service — Inbound Reporter",
  description: "Terms of Service for Inbound Reporter.",
}

export default function TermsPage() {
  return <TermsContent />
}
