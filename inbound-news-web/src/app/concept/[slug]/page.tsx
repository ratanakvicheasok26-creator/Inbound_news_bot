import { notFound } from "next/navigation"
import Link from "next/link"
import { getAllStories } from "@/lib/posts"
import { StoryRow } from "@/components/story/StoryRow"
import { ArrowLeft, TrendingUp } from "lucide-react"

const CONCEPTS: Record<string, { name: string; definition: string; inflectionPoints: { date: string; event: string }[] }> = {
  "transformers": {
    name: "Transformers",
    definition: "A neural network architecture introduced by Google in 2017 ('Attention Is All You Need') that processes sequential data in parallel. It replaced RNNs/LSTMs as the dominant architecture for language, vision, and multimodal AI.",
    inflectionPoints: [
      { date: "2017-06", event: "Google publishes 'Attention Is All You Need'" },
      { date: "2018-06", event: "OpenAI releases GPT-1 (117M parameters)" },
      { date: "2020-05", event: "GPT-3 demonstrates few-shot learning" },
      { date: "2022-11", event: "ChatGPT launches, reaches 100M users in 2 months" },
      { date: "2023-03", event: "GPT-4 released with multimodal capabilities" },
    ],
  },
  "rag": {
    name: "RAG (Retrieval-Augmented Generation)",
    definition: "A technique that combines a language model with an external knowledge retrieval system. The model generates answers grounded in retrieved documents, reducing hallucinations and enabling knowledge updates without retraining.",
    inflectionPoints: [
      { date: "2020-05", event: "Facebook AI Research publishes original RAG paper" },
      { date: "2023-02", event: "LangChain popularizes RAG for enterprise applications" },
      { date: "2023-08", event: "Major enterprises adopt RAG for customer-facing AI" },
    ],
  },
  "llm": {
    name: "Large Language Models",
    definition: "Neural networks trained on massive text datasets (billions to trillions of tokens) that can generate, translate, summarize, and reason about human language. Examples include GPT-4, Claude, Gemini, and LLaMA.",
    inflectionPoints: [
      { date: "2020-05", event: "GPT-3 (175B parameters) demonstrates emergent abilities" },
      { date: "2023-03", event: "GPT-4 achieves human-level on many benchmarks" },
      { date: "2023-07", event: "Meta releases LLaMA, sparking open-source LLM wave" },
      { date: "2024-02", event: "Mistral and Gemini push efficiency and multimodal boundaries" },
    ],
  },
}

export default async function ConceptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const concept = CONCEPTS[slug]

  if (!concept) notFound()

  const stories = await getAllStories()
  const relatedStories = stories.filter((s) =>
    s.tags?.some((t) => t.toLowerCase().includes(slug)) ||
    s.title.toLowerCase().includes(concept.name.toLowerCase())
  ).slice(0, 10)

  return (
    <div className="container">
      <div className="pt-6 pb-4">
        <Link href="/glossary" className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--red-hover)] transition-colors">
          <ArrowLeft className="h-3 w-3" />
          Back to Glossary
        </Link>
      </div>

      <section className="py-8 border-b-2 border-[var(--text-primary)]">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-[var(--accent)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">Concept</span>
        </div>
        <h1 className="page-title">
          {concept.name}
        </h1>
        <p className="mt-3 text-[16px] text-[var(--text-secondary)] leading-[1.7] max-w-[720px]">
          {concept.definition}
        </p>
        <div className="mt-4 font-mono text-[11px] text-[var(--text-secondary)]">
          {relatedStories.length} related stor{relatedStories.length !== 1 ? "ies" : "y"}
        </div>
      </section>

      {/* Coverage Volume Sparkline (placeholder) */}
      <section className="py-8 border-b border-[var(--border)]">
        <div className="section-header">
          <h2 className="section-title">Coverage Volume (12 months)</h2>
        </div>
        <div className="h-[120px] bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
          <span className="font-mono text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
            Coverage chart — coming soon
          </span>
        </div>
      </section>

      {/* Key Inflection Points */}
      <section className="py-8 border-b border-[var(--border)]">
        <div className="section-header">
          <h2 className="section-title">Key Inflection Points</h2>
        </div>
        <div className="space-y-0">
          {concept.inflectionPoints.map((point) => (
            <div key={point.date} className="flex gap-4 py-3 border-b border-[var(--border)] last:border-0">
              <span className="font-mono text-[12px] text-[var(--accent)] tabular-nums shrink-0 w-[80px]">
                {point.date}
              </span>
              <span className="text-[14px] text-[var(--text-primary)]">
                {point.event}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Related Stories */}
      <section className="py-8">
        <div className="section-header">
          <h2 className="section-title">Related Stories</h2>
        </div>
        {relatedStories.length === 0 ? (
          <div className="empty-state py-8">
            <p>No related stories yet.</p>
          </div>
        ) : (
          <div>
            {relatedStories.map((story) => (
              <StoryRow key={story.id} story={story} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
