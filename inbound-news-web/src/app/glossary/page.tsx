import type { Metadata } from "next"
import { GlossaryContent } from "./GlossaryContent"

export const metadata: Metadata = {
  title: "Glossary — Inbound Reports",
  description: "Tech jargon explained in English and Khmer — built for digital literacy.",
}

export default function GlossaryPage() {
  return <GlossaryContent />
}
