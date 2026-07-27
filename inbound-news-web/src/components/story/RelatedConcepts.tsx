import Link from "next/link"

interface RelatedConceptsProps {
  concepts: string[]
}

export function RelatedConcepts({ concepts }: RelatedConceptsProps) {
  if (concepts.length === 0) return null

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)] mb-2">
        Related Concepts
      </p>
      <div className="flex flex-wrap gap-2">
        {concepts.map((concept) => (
          <Link
            key={concept}
            href={`/concept/${concept.toLowerCase().replace(/\s+/g, "-")}`}
            className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] font-mono text-[11px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            {concept}
          </Link>
        ))}
      </div>
    </div>
  )
}
