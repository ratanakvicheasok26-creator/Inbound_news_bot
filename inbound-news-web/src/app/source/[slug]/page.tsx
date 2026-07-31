import { notFound } from "next/navigation"
import Link from "next/link"
import { getStoriesBySourceDomain } from "@/lib/posts"
import { StoryRow } from "@/components/story/StoryRow"
import { TrustRadar } from "@/components/story/TrustRadar"
import { ArrowLeft, ExternalLink, Shield } from "lucide-react"

const SOURCES: Record<string, {
  name: string
  domain: string
  trust_scores: { primary_sourcing: number; technical_accuracy: number; originality: number; corrections: number; funding_disclosure: number }
  ownership: string
  funding: string
}> = {
  "reuters": {
    name: "Reuters",
    domain: "reuters.com",
    trust_scores: { primary_sourcing: 5, technical_accuracy: 4, originality: 3, corrections: 5, funding_disclosure: 4 },
    ownership: "Thomson Reuters",
    funding: "Commercial news agency, subscriber-funded",
  },
  "techcrunch": {
    name: "TechCrunch",
    domain: "techcrunch.com",
    trust_scores: { primary_sourcing: 3, technical_accuracy: 3, originality: 4, corrections: 3, funding_disclosure: 3 },
    ownership: "Yahoo Inc.",
    funding: "VC-backed (acquired by AOL in 2010, then Verizon, now Yahoo)",
  },
  "the-verge": {
    name: "The Verge",
    domain: "theverge.com",
    trust_scores: { primary_sourcing: 3, technical_accuracy: 4, originality: 4, corrections: 4, funding_disclosure: 3 },
    ownership: "Vox Media",
    funding: "VC-backed media company",
  },
  "arstechnica": {
    name: "Ars Technica",
    domain: "arstechnica.com",
    trust_scores: { primary_sourcing: 4, technical_accuracy: 5, originality: 3, corrections: 4, funding_disclosure: 3 },
    ownership: "Condé Nast",
    funding: "Part of Advance Publications",
  },
}

export default async function SourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const source = SOURCES[slug]

  if (!source) notFound()

  const recentStories = (await getStoriesBySourceDomain(source.domain)).slice(0, 20)

  const scores = source.trust_scores
  const avgScore = Math.round(
    (scores.primary_sourcing + scores.technical_accuracy + scores.originality + scores.corrections + scores.funding_disclosure) / 5
  )

  return (
    <div className="container">
      <div className="pt-6 pb-4">
        <Link href="/" className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--red-hover)] transition-colors">
          <ArrowLeft className="h-3 w-3" />
          Back to feed
        </Link>
      </div>

      <section className="py-8 border-b-2 border-[var(--text-primary)]">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-[var(--accent)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">Source Profile</span>
        </div>
        <h1 className="page-title">
          {source.name}
        </h1>
        <a href={`https://${source.domain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 font-mono text-[12px] text-[var(--text-secondary)] hover:text-[var(--red-hover)] transition-colors">
          {source.domain}
          <ExternalLink className="h-3 w-3" />
        </a>
      </section>

      {/* Trust Radar */}
      <section className="py-8 border-b border-[var(--border)]">
        <div className="section-header">
          <h2 className="section-title">Trust radar</h2>
          <span className="font-mono text-[14px] font-bold tabular-nums text-[var(--text-primary)]">
            {avgScore}/5
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { label: "Primary Sourcing", score: scores.primary_sourcing },
            { label: "Technical Accuracy", score: scores.technical_accuracy },
            { label: "Originality", score: scores.originality },
            { label: "Correction History", score: scores.corrections },
            { label: "Funding Disclosure", score: scores.funding_disclosure },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-[var(--border)]">
              <span className="text-[13px] text-[var(--text-secondary)]">{item.label}</span>
              <TrustRadar score={item.score} size="md" />
            </div>
          ))}
        </div>
      </section>

      {/* Ownership */}
      <section className="py-8 border-b border-[var(--border)]">
        <div className="section-header">
          <h2 className="section-title">Ownership &amp; funding</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 bg-[var(--surface)] border border-[var(--border)]">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)] block mb-1">Ownership</span>
            <p className="text-[14px] text-[var(--text-primary)]">{source.ownership}</p>
          </div>
          <div className="p-4 bg-[var(--surface)] border border-[var(--border)]">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)] block mb-1">Funding</span>
            <p className="text-[14px] text-[var(--text-primary)]">{source.funding}</p>
          </div>
        </div>
      </section>

      {/* Recent Stories */}
      <section className="py-8">
        <div className="section-header">
          <h2 className="section-title">Recent stories from {source.name}</h2>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            {recentStories.length} stories
          </span>
        </div>
        {recentStories.length === 0 ? (
          <div className="empty-state py-8">
            <p>No stories from this source yet.</p>
          </div>
        ) : (
          <div>
            {recentStories.map((story) => (
              <StoryRow key={story.id} story={story} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
