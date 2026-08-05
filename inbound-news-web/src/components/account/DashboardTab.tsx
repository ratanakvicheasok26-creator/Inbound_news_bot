"use client"

import Link from "next/link"
import { getProfile } from "@/lib/profile"
import { getCategoryLabel } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"

export function DashboardTab() {
  const profile = getProfile()
  const recent = profile.recentlyRead.slice(0, 5)

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Literacy score", value: profile.literacyScore.toLocaleString() },
          { label: "Day streak", value: String(profile.readingStreak.current) },
          { label: "Saved", value: String(profile.savedStoryIds.length) },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] px-5 py-4"
          >
            <div className="font-display text-[28px] font-semibold tabular-nums">{item.value}</div>
            <div className="meta-text mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      <section>
        <div className="section-header">
          <h2 className="section-title">Recently read</h2>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state py-10 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)]">
            <p className="text-[15px] text-[var(--text-primary)] mb-1">No stories decoded yet</p>
            <p className="text-[13px]">Decode a story to start tracking literacy points.</p>
          </div>
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] divide-y divide-[var(--border)]">
            {recent.map((entry, i) => (
              <Link
                key={entry.id}
                href={`/story/${entry.id}`}
                className="flex items-start gap-4 px-5 py-4 hover:bg-[var(--surface-alt)] transition-colors"
              >
                <span className="font-display text-[18px] font-semibold text-[var(--accent)] tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="meta-text text-[var(--accent)]">
                      {getCategoryLabel(entry.category)}
                    </span>
                    <span className="meta-text">{formatDistanceToNow(entry.readAt)}</span>
                  </div>
                  <h4 className="story-title line-clamp-2">{entry.title}</h4>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="section-header">
          <h2 className="section-title">How to earn points</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { action: "Decode a story", pts: "+5", desc: "Open a clustered story to start tracking" },
            { action: "Tap a jargon term", pts: "+10", desc: "Learn a tech term from the glossary" },
            { action: "Switch reading tier", pts: "+15", desc: "Move between ELI5, Standard, and Deep" },
            { action: "Compare sources", pts: "+20", desc: "Review multiple sources on one story" },
          ].map((item) => (
            <div
              key={item.action}
              className="flex items-start gap-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)]"
            >
              <span className="font-display text-[20px] font-semibold text-[var(--accent)] tabular-nums">
                {item.pts}
              </span>
              <div>
                <span className="text-[14px] font-semibold block">{item.action}</span>
                <span className="text-[13px] text-[var(--text-secondary)]">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
