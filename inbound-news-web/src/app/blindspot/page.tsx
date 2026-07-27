import { getAllStories } from "@/lib/posts"
import { StoryRow } from "@/components/story/StoryRow"
import { BlindspotCard } from "@/components/story/BlindspotCard"
import { Eye } from "lucide-react"

export const metadata = {
  title: "Blindspot — Inbound Reports",
  description: "Tech stories that mainstream media is ignoring.",
}

export default async function BlindspotPage() {
  const stories = await getAllStories()

  return (
    <div className="container">
      <section className="py-10">
        <div className="section-header">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[var(--red-alert)]" />
            <h1 className="font-serif text-[28px] font-bold">Tech Media Blindspots</h1>
          </div>
        </div>

        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed max-w-[640px] mb-8">
          Stories highly covered by technical and primary sources but ignored by mainstream aggregators.
          These are the stories that matter but aren&apos;t making the rounds.
        </p>

        <div className="grid gap-4 md:grid-cols-2 mb-10">
          <BlindspotCard
            title="Cambodia's new data privacy law takes effect with unclear enforcement"
            summary="Only 2 sources covering this — both from regional tech press. Mainstream media has not picked this up."
            sourceCount={2}
            sourceNames={["Tech in Asia", "Rest of World"]}
          />
          <BlindspotCard
            title="Southeast Asian startups shifting from growth to profitability ahead of global peers"
            summary="Mainstream media has not picked this up."
            sourceCount={3}
            sourceNames={["e27", "KrASIA"]}
          />
          <BlindspotCard
            title="Open-source AI models closing the gap with proprietary systems"
            summary="Technical press covers this extensively but mainstream outlets still frame AI as a big-tech-only story."
            sourceCount={8}
            sourceNames={["Hugging Face Blog", "arXiv", "VentureBeat"]}
          />
          <BlindspotCard
            title="Pacific undersea cable project to boost Cambodia's internet bandwidth"
            summary="Only infrastructure trades are covering this. No mainstream pickup."
            sourceCount={3}
            sourceNames={["Submarine Networks", "Capacity Media"]}
          />
        </div>

        <div className="section-header">
          <h2 className="section-title">All Underreported Stories</h2>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            {stories.length} stories
          </span>
        </div>
        <div>
          {stories.map((story) => (
            <StoryRow key={story.id} story={story} />
          ))}
        </div>
      </section>
    </div>
  )
}
