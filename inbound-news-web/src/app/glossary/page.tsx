import type { Metadata } from "next"
import { GlossaryContent } from "./GlossaryContent"

export const metadata: Metadata = {
  title: "Glossary — Inbound Reporter",
  description: "A searchable encyclopedia of tech jargon.",
}

export default function GlossaryPage() {
  return <GlossaryContent />
}
