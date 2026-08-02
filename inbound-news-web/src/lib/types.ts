export type Story = {
  id: string
  title: string
  summary_en: string | null
  source_count: number
  category: string | null
  tags: string[]
  created_at: string
  image_url?: string | null
  primary_url?: string | null
  primary_source?: string | null
  primary_source_domain?: string | null
}

export type Article = {
  id: string
  title: string
  summary: string | null
  url: string
  source_name: string | null
  source_domain: string | null
  category: string | null
  language: string | null
  published_at: string | null
  ingested_at: string
  image_url?: string | null
  raw_json?: unknown
}

export type StoryWithArticles = Story & {
  articles: Article[]
}

export type GlossaryTerm = {
  slug: string
  term_en: string
  term_km: string
  definition_en: string
  definition_km: string
  analogy: string
  story_count: number
}

export type Concept = {
  slug: string
  name: string
  definition: string
  story_count: number
  related_stories: Story[]
}

export type WebResult = {
  title: string
  url: string
  source_name: string
  source_domain: string
  summary: string
  published_at: string | null
}

export type Source = {
  slug: string
  name: string
  domain: string
  trust_scores: {
    primary_sourcing: number
    technical_accuracy: number
    originality: number
    corrections: number
    funding_disclosure: number
  }
  ownership: string
  funding: string
  recent_stories: Story[]
}
