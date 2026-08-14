"use client"

import { useState } from "react"
import { Check, Plus } from "lucide-react"
import {
  isConceptFollowed,
  isTopicFollowed,
  toggleFollowedConcept,
  toggleFollowedTopic,
} from "@/lib/profile"

type FollowKind = "topic" | "concept"

export function FollowButton({
  kind,
  slug,
  label,
}: {
  kind: FollowKind
  slug: string
  label?: string
}) {
  const [followed, setFollowed] = useState(() =>
    kind === "topic" ? isTopicFollowed(slug) : isConceptFollowed(slug)
  )

  function handleClick() {
    const next =
      kind === "topic" ? toggleFollowedTopic(slug) : toggleFollowedConcept(slug)
    setFollowed(next)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex h-9 items-center gap-1.5 px-3 text-[13px] font-medium rounded-[var(--radius-sm)] border transition-colors ${
        followed
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:border-[var(--text-secondary)]"
      }`}
      aria-pressed={followed}
    >
      {followed ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      {followed ? "Following" : label || "Follow"}
    </button>
  )
}
