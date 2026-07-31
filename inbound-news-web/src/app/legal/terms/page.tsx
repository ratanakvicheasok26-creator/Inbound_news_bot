import type { Metadata } from "next"
import { TermsContent } from "@/components/legal/TermsContent"

export const metadata: Metadata = {
  title: "Terms of Service — Inbound Reports",
  description: "Terms of Service for Inbound Reports.",
}

export default function TermsPage() {
  return <TermsContent />
}
