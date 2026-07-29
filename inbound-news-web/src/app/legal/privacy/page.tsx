import type { Metadata } from "next"
import { PrivacyPolicyContent } from "@/components/legal/PrivacyPolicyContent"

export const metadata: Metadata = {
  title: "Privacy Policy — Inbound Reports",
  description: "How Inbound Reports handles your information when you use our website and services.",
}

export default function PrivacyPage() {
  return <PrivacyPolicyContent />
}
