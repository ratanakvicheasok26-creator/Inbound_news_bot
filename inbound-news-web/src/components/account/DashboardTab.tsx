"use client"

import Link from "next/link"
import { getProfile } from "@/lib/profile"
import { getCategoryLabel } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import { OUTLET_ROLE_LABELS, type OutletRole } from "@/lib/outlet-roles"

function tally<T extends string>(items: T[]): { key: T; count: number }[] {
  const map = new Map<T, number>()
  for (const item of items) {
    if (!item) continue
    map.set(item, (map.get(item) || 0) + 1)
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
}

export function DashboardTab() {
  const profile = getProfile()
  const recent = profile.recentlyRead.slice(0, 5)
  const categoryDiet = tally(
    profile.recentlyRead.map((r) => r.category).filter(Boolean) as string[]
  ).slice(0, 6)
  const roleDiet = tally(
    profile.recentlyRead
      .map((r) => r.outletRole)
      .filter((r): r is string => Boolean(r))
  ).slice(0, 6)
  const followedTopics = profile.followedTopics || []
  const followedConcepts = profile.followedConcepts || []

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
          <h2 className="section-title">My News Diet</h2>
          <span className="meta-text">This device · last {profile.recentlyRead.length} reads</span>
        </div>
        {profile.recentlyRead.length === 0 ? (
          <div className="empty-state py-10 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)]">
            <p className="text-[15px] text-[var(--text-primary)] mb-1">No reading diet yet</p>
            <p className="text-[13px]">
              Decode stories to see which desks and outlet roles you lean on — a personal
              blindspot check.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-5">
              <h3 className="text-[13px] font-semibold mb-3">Desks you read</h3>
              {categoryDiet.length === 0 ? (
                <p className="text-[13px] text-[var(--text-secondary)]">No categories tracked yet.</p>
              ) : (
                <ul className="space-y-2">
                  {categoryDiet.map(({ key, count }) => (
                    <li key={key} className="flex items-center justify-between gap-3 text-[13px]">
                      <Link href={`/topic/${key}`} className="hover:text-[var(--accent)]">
                        {getCategoryLabel(key)}
                      </Link>
                      <span className="meta-text tabular-nums">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-5">
              <h3 className="text-[13px] font-semibold mb-3">Outlet roles in your feed</h3>
              {roleDiet.length === 0 ? (
                <p className="text-[13px] text-[var(--text-secondary)]">
                  Roles appear after you open stories with coverage data.
                </p>
              ) : (
                <ul className="space-y-2">
                  {roleDiet.map(({ key, count }) => (
                    <li key={key} className="flex items-center justify-between gap-3 text-[13px]">
                      <span>
                        {OUTLET_ROLE_LABELS[key as OutletRole] || key}
                      </span>
                      <span className="meta-text tabular-nums">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Heavy on Booster or Corporate? Try Blindspot → Research / Critical filters.
              </p>
            </div>
          </div>
        )}
      </section>

      {(followedTopics.length > 0 || followedConcepts.length > 0) && (
        <section>
          <div className="section-header">
            <h2 className="section-title">Following</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {followedTopics.map((slug) => (
              <Link
                key={`t-${slug}`}
                href={`/topic/${slug}`}
                className="chip hover:border-[var(--accent)]"
              >
                {getCategoryLabel(slug)}
              </Link>
            ))}
            {followedConcepts.map((slug) => (
              <Link
                key={`c-${slug}`}
                href={`/concept/${slug}`}
                className="chip hover:border-[var(--accent)]"
              >
                {slug}
              </Link>
            ))}
          </div>
        </section>
      )}

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
