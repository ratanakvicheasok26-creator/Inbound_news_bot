export const CATEGORIES = [
  { slug: "ai", label: "AI & ML" },
  { slug: "cybersecurity", label: "Cybersecurity" },
  { slug: "startups", label: "Startups" },
  { slug: "defi", label: "DeFi & Crypto" },
  { slug: "big_tech", label: "Big Tech" },
  { slug: "hardware", label: "Hardware" },
  { slug: "science", label: "Science" },
  { slug: "regulation", label: "Regulation" },
  { slug: "cloud", label: "Cloud & DevOps" },
  { slug: "opensource", label: "Open Source" },
  { slug: "gaming", label: "Gaming" },
  { slug: "climate", label: "Climate Tech" },
  { slug: "telecom", label: "Telecom" },
  { slug: "mobile", label: "Mobile" },
  { slug: "regional", label: "SE Asia" },
] as const

export type CategorySlug = (typeof CATEGORIES)[number]["slug"]

export const CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.label])
)

export const getCategoryLabel = (slug: string): string =>
  CATEGORY_MAP[slug] || slug
