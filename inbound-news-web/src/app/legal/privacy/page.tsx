import type { Metadata } from "next"
import { PrivacyPolicyContent } from "@/components/legal/PrivacyPolicyContent"

export const metadata: Metadata = {
  title: "Privacy Policy — Inbound Reporter",
  description: "How Inbound Reporter handles your information when you use our website and services.",
}

export default function PrivacyPage() {
  return <PrivacyPolicyContent />
}
