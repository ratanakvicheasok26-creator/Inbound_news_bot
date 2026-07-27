export function DnaTag({ type, label }: { type: string; label: string }) {
  return (
    <span className={`dna-tag dna-tag-${type}`}>
      {label}
    </span>
  )
}
