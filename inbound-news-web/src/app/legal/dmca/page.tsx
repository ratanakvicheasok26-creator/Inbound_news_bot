import type { Metadata } from "next"
import { DmcaContent } from "@/components/legal/DmcaContent"

export const metadata: Metadata = {
  title: "Copyright & DMCA — Inbound Reports",
  description: "Copyright policy and takedown procedures for Inbound Reports.",
}

export default function DmcaPage() {
  return <DmcaContent />
}
