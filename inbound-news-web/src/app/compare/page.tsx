import type { Metadata } from "next"
import {
  getArticleOptionById,
  getRelatedOptionsFor,
  getRecentCompareOptions,
  isUuid,
  type CompareOption,
} from "@/lib/compare"
import { CompareView } from "@/components/compare/CompareView"

export const metadata: Metadata = {
  title: "Compare articles — Inbound Reports",
  description:
    "Side-by-side comparison of two related news articles — shared facts, key differences, perspectives, and agreement.",
}

export const revalidate = 0

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>
}) {
  const params = await searchParams
  const idA = typeof params.a === "string" ? params.a : ""
  const idB = typeof params.b === "string" && params.b !== idA ? params.b : ""

  const [articleA, articleB, relatedRes] = await Promise.all([
    idA && isUuid(idA) ? getArticleOptionById(idA) : Promise.resolve(null),
    idB && isUuid(idB) ? getArticleOptionById(idB) : Promise.resolve(null),
    idA && isUuid(idA)
      ? getRelatedOptionsFor(idA)
      : Promise.resolve({ related: [] as CompareOption[], storyId: null, storyTitle: null }),
  ])

  let recentOptions: CompareOption[] = []
  if (!articleA || !articleB) {
    recentOptions = await getRecentCompareOptions()
  }

  const relatedToA = relatedRes.related.filter((r) => r.id !== idA)

  return (
    <CompareView
      articleA={articleA}
      articleB={articleB}
      relatedToA={relatedToA}
      recentOptions={recentOptions}
      storyTitle={relatedRes.storyTitle}
    />
  )
}
