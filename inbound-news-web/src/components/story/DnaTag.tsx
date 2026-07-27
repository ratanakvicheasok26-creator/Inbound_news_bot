import { AlertTriangle } from "lucide-react"

interface DnaTagProps {
  type: "hype" | "kh" | "concept" | "breaking" | "blindspot"
  label: string
}

const tagStyles: Record<string, string> = {
  hype: "dna-tag dna-tag-hype",
  kh: "dna-tag dna-tag-kh",
  concept: "dna-tag dna-tag-concept",
  breaking: "dna-tag",
  blindspot: "dna-tag dna-tag-hype",
}

const breakingStyle = { background: "var(--red-breaking)", color: "#fff", border: "none" }
const blindspotStyle = { background: "var(--red-subtle-bg)", color: "var(--red-subtle-text)", border: "1px solid var(--red-alert)" }

export function DnaTag({ type, label }: DnaTagProps) {
  const style = type === "breaking" ? breakingStyle : type === "blindspot" ? blindspotStyle : undefined

  return (
    <span className={tagStyles[type] || "dna-tag"} style={style}>
      {type === "hype" && <AlertTriangle className="h-2.5 w-2.5" />}
      {label}
    </span>
  )
}
