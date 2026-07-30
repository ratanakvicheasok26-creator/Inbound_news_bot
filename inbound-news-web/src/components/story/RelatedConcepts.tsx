import Link from "next/link"

export type RelatedConcept = string | { label: string; slug: string }

const SLUG_ALIASES: Record<string, string> = {
  transformer: "transformers",
  transformers: "transformers",
  rag: "rag",
  llm: "llm",
  gpu: "gpu",
}

function resolveConcept(concept: RelatedConcept): { label: string; slug: string } {
  if (typeof concept !== "string") return concept
  const key = concept.toLowerCase().replace(/\s+/g, "-")
  return { label: concept, slug: SLUG_ALIASES[key] || key }
}

interface RelatedConceptsProps {
  concepts: RelatedConcept[]
}

export function RelatedConcepts({ concepts }: RelatedConceptsProps) {
  if (concepts.length === 0) return null

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-secondary)] mb-2">
        Related Concepts
      </p>
      <div className="flex flex-wrap gap-2">
        {concepts.map((concept) => {
          const { label, slug } = resolveConcept(concept)
          return (
            <Link
              key={slug}
              href={`/concept/${slug}`}
              className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] font-mono text-[11px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
