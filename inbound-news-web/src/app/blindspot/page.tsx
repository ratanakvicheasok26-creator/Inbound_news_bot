import { getAllStoriesSafe } from "@/lib/posts"
import { BlindspotExplorer } from "@/components/story/BlindspotExplorer"
import { FeatureGate } from "@/components/membership/FeatureGate"
import { filterTechStories } from "@/lib/tech-scope"
import { Eye } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Blindspot — Inbound Reports",
  description:
    "Coverage gaps in technology news — single-outlet and thinly skewed clusters the wider press has not picked up.",
}

export default async function BlindspotPage() {
  const { stories: raw, error } = await getAllStoriesSafe(80)
  const stories = filterTechStories(raw)

  return (
    <div className="container">
      <section className="py-10">
        <div className="section-header">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[var(--red-alert)]" />
            <h1 className="page-title">Coverage blindspots</h1>
          </div>
        </div>

        <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-[640px] mb-8">
          Stories the wider press has barely covered — one outlet, or two that lean the same way.
          Pick a <strong className="font-semibold text-[var(--text-primary)]">coverage lens</strong>{" "}
          below. Full desks live under{" "}
          <Link href="/topic/ai" className="text-[var(--accent)] hover:underline">
            Topics
          </Link>
          ; today&apos;s digest under{" "}
          <Link href="/brief" className="text-[var(--accent)] hover:underline">
            Brief
          </Link>
          .
        </p>

        <FeatureGate feature="undercovered">
          <BlindspotExplorer stories={stories} error={error} />
        </FeatureGate>
      </section>
    </div>
  )
}
