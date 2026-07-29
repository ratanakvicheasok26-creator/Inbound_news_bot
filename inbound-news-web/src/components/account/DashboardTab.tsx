"use client"

import Link from "next/link"
import { getProfile } from "@/lib/profile"
import { getCategoryLabel } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"

export function DashboardTab() {
  const profile = getProfile()
  const recent = profile.recentlyRead.slice(0, 3)

  return (
    <div className="space-y-10">
      {/* HERO — Score + Streak */}
      <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end pb-8 border-b-2 border-[var(--text-primary)]">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-secondary)] font-bold block mb-3">
            Literacy Score
          </span>
          <div className="font-mono text-[72px] md:text-[96px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-[var(--text-primary)]">
            {profile.literacyScore.toLocaleString()}
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)] mt-2">
            Points earned
          </div>
        </div>

        <div className="flex gap-8 md:gap-10">
          <div className="text-center">
            <div className="font-mono text-[36px] font-extrabold leading-none tabular-nums text-[var(--accent)]">
              {profile.readingStreak.current}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-secondary)] mt-1 font-bold">
              Day Streak
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-[36px] font-extrabold leading-none tabular-nums">
              {profile.savedStoryIds.length}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-secondary)] mt-1 font-bold">
              Saved
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-[36px] font-extrabold leading-none tabular-nums">
              {profile.followedConcepts.length}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-secondary)] mt-1 font-bold">
              Followed
            </div>
          </div>
        </div>
      </div>

      {/* RECENTLY READ */}
      <div>
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-number mr-3">01</span>
            Recently Read
          </h2>
        </div>

        {recent.length === 0 ? (
          <div className="py-16 text-center border border-[var(--border)]">
            <p className="font-mono text-[13px] text-[var(--text-secondary)] uppercase tracking-wider">
              No stories read yet
            </p>
            <p className="font-mono text-[11px] text-[var(--text-secondary)] mt-2">
              Start reading to earn points.
            </p>
          </div>
        ) : (
          <div>
            {recent.map((entry, i) => (
              <Link
                key={entry.id}
                href={`/story/${entry.id}`}
                className="flex items-start gap-4 py-5 border-b border-[var(--border)] hover:bg-[var(--surface-alt)] transition-colors px-3 -mx-3"
              >
                <span className="font-mono text-[24px] font-bold text-[var(--accent)] tabular-nums leading-none mt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)] font-bold">
                      {getCategoryLabel(entry.category)}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                      {formatDistanceToNow(entry.readAt)}
                    </span>
                  </div>
                  <h4 className="story-title line-clamp-2">
                    {entry.title}
                  </h4>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* HOW TO EARN POINTS */}
      <div>
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-number mr-3">02</span>
            How to Earn Points
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { action: "Open a story", pts: "+5", desc: "Read a story to start tracking" },
            { action: "Tap a jargon term", pts: "+10", desc: "Learn a tech term from the glossary" },
            { action: "Switch reading tier", pts: "+15", desc: "Challenge yourself with deeper content" },
            { action: "Open source comparison", pts: "+20", desc: "Compare multiple sources on one story" },
          ].map((item) => (
            <div
              key={item.action}
              className="flex items-start gap-4 p-4 border border-[var(--border)] hover:border-[var(--text-primary)] transition-colors"
            >
              <span className="font-mono text-[20px] font-extrabold text-[var(--accent)] tabular-nums leading-none mt-0.5">
                {item.pts}
              </span>
              <div>
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] font-bold text-[var(--text-primary)] block">
                  {item.action}
                </span>
                <span className="font-mono text-[10px] text-[var(--text-secondary)] mt-0.5 block">
                  {item.desc}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
