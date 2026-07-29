import type { Metadata } from "next"
import { DmcaContent } from "@/components/legal/DmcaContent"

export const metadata: Metadata = {
  title: "Copyright & DMCA — Inbound Reporter",
  description: "Copyright policy and takedown procedures for Inbound Reporter.",
}

export default function DmcaPage() {
  return <DmcaContent />
}
