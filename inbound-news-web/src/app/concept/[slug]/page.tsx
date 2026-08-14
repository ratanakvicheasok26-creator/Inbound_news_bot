import { notFound } from "next/navigation"
import Link from "next/link"
import { getAllStoriesSafe } from "@/lib/posts"
import { filterTechStories } from "@/lib/tech-scope"
import { StoryRow } from "@/components/story/StoryRow"
import { FollowButton } from "@/components/FollowButton"
import { ArrowLeft, TrendingUp } from "lucide-react"

type ConceptEntry = {
  name: string
  definition: string
  inflectionPoints: { date: string; event: string }[]
}

const CONCEPTS: Record<string, ConceptEntry> = {
  transformers: {
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
  rag: {
    name: "RAG (Retrieval-Augmented Generation)",
    definition: "A technique that combines a language model with an external knowledge retrieval system. The model generates answers grounded in retrieved documents, reducing hallucinations and enabling knowledge updates without retraining.",
    inflectionPoints: [
      { date: "2020-05", event: "Facebook AI Research publishes original RAG paper" },
      { date: "2023-02", event: "LangChain popularizes RAG for enterprise applications" },
      { date: "2023-08", event: "Major enterprises adopt RAG for customer-facing AI" },
    ],
  },
  llm: {
    name: "Large Language Models",
    definition: "Neural networks trained on massive text datasets (billions to trillions of tokens) that can generate, translate, summarize, and reason about human language. Examples include GPT-4, Claude, Gemini, and LLaMA.",
    inflectionPoints: [
      { date: "2020-05", event: "GPT-3 (175B parameters) demonstrates emergent abilities" },
      { date: "2023-03", event: "GPT-4 achieves human-level on many benchmarks" },
      { date: "2023-07", event: "Meta releases LLaMA, sparking open-source LLM wave" },
      { date: "2024-02", event: "Mistral and Gemini push efficiency and multimodal boundaries" },
    ],
  },
  gpu: {
    name: "GPU (Graphics Processing Unit)",
    definition: "A specialized processor originally designed for rendering graphics, now the primary hardware for training and running AI models. GPUs excel at parallel math, which is why they dominate deep learning workloads.",
    inflectionPoints: [
      { date: "1999-08", event: "NVIDIA launches GeForce 256, popularizing the GPU name" },
      { date: "2006-11", event: "CUDA unlocks GPUs for general-purpose computing" },
      { date: "2012-09", event: "AlexNet wins ImageNet using GPUs, kickstarting the deep learning boom" },
      { date: "2022-09", event: "H100 / A100 scarcity becomes a strategic constraint for AI labs" },
    ],
  },
}

/** Singular / alternate slugs that resolve to a canonical concept entry. */
const CONCEPT_ALIASES: Record<string, string> = {
  transformer: "transformers",
}

export default async function ConceptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const canonicalSlug = CONCEPT_ALIASES[slug] || slug
  const concept = CONCEPTS[canonicalSlug]

  if (!concept) notFound()

  const { stories, error } = await getAllStoriesSafe(80)
  const relatedStories = filterTechStories(stories)
    .filter(
      (s) =>
        s.tags?.some(
          (t) =>
            t.toLowerCase().includes(canonicalSlug) ||
            t.toLowerCase().includes(slug)
        ) || s.title.toLowerCase().includes(concept.name.toLowerCase())
    )
    .slice(0, 10)

  return (
    <div className="container">
      <div className="pt-6 pb-4">
        <Link href="/glossary" className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--red-hover)] transition-colors">
          <ArrowLeft className="h-3 w-3" />
          Back to Glossary
        </Link>
      </div>

      <section className="py-8 border-b-2 border-[var(--text-primary)]">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-[var(--accent)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">Concept</span>
          <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] text-[var(--text-secondary)]">
            Beta · curated set
          </span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="page-title">{concept.name}</h1>
          <FollowButton kind="concept" slug={canonicalSlug} />
        </div>
        <p className="mt-3 text-[16px] text-[var(--text-secondary)] leading-[1.7] max-w-[720px]">
          {concept.definition}
        </p>
        <div className="mt-4 font-mono text-[11px] text-[var(--text-secondary)]">
          {relatedStories.length} related stor{relatedStories.length !== 1 ? "ies" : "y"}
        </div>
      </section>

      {/* Key Inflection Points */}
      <section className="py-8 border-b border-[var(--border)]">
        <div className="section-header">
          <h2 className="section-title">Key inflection points</h2>
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
          <h2 className="section-title">Related stories</h2>
        </div>
        {error ? (
          <div className="empty-state py-8">
            <p>Could not load related stories: {error}</p>
          </div>
        ) : relatedStories.length === 0 ? (
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
