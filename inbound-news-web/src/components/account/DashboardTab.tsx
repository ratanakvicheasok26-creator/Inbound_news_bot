"use client"

import Link from "next/link"
import { getProfile } from "@/lib/profile"
import { CATEGORY_MAP } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/LocaleProvider"

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
  const { t } = useI18n()
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
          { key: "literacyScore", label: t("account.dashboard.literacyScore"), value: profile.literacyScore.toLocaleString() },
          { key: "dayStreak", label: t("account.dashboard.dayStreak"), value: String(profile.readingStreak.current) },
          { key: "saved", label: t("account.dashboard.saved"), value: String(profile.savedStoryIds.length) },
        ].map((item) => (
          <div
            key={item.key}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] px-5 py-4"
          >
            <div className="font-display text-[28px] font-semibold tabular-nums">{item.value}</div>
            <div className="meta-text mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      <section>
        <div className="section-header">
          <h2 className="section-title">{t("account.dashboard.newsDiet")}</h2>
          <span className="meta-text">
            {t("account.dashboard.thisDevice", { count: profile.recentlyRead.length })}
          </span>
        </div>
        {profile.recentlyRead.length === 0 ? (
          <div className="empty-state py-10 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)]">
            <p className="text-[15px] text-[var(--text-primary)] mb-1">{t("account.dashboard.noDietTitle")}</p>
            <p className="text-[13px]">{t("account.dashboard.noDietBody")}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-5">
              <h3 className="text-[13px] font-semibold mb-3">{t("account.dashboard.desksYouRead")}</h3>
              {categoryDiet.length === 0 ? (
                <p className="text-[13px] text-[var(--text-secondary)]">{t("account.dashboard.noCategories")}</p>
              ) : (
                <ul className="space-y-2">
                  {categoryDiet.map(({ key, count }) => (
                    <li key={key} className="flex items-center justify-between gap-3 text-[13px]">
                      <Link href={`/topic/${key}`} className="hover:text-[var(--accent)]">
                        {CATEGORY_MAP[key] ? t(`category.${key}`) : key}
                      </Link>
                      <span className="meta-text tabular-nums">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-5">
              <h3 className="text-[13px] font-semibold mb-3">{t("account.dashboard.outletRoles")}</h3>
              {roleDiet.length === 0 ? (
                <p className="text-[13px] text-[var(--text-secondary)]">
                  {t("account.dashboard.rolesHint")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {roleDiet.map(({ key, count }) => (
                    <li key={key} className="flex items-center justify-between gap-3 text-[13px]">
                      <span>
                        {t(`outletRoles.${key}`)}
                      </span>
                      <span className="meta-text tabular-nums">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                {t("account.dashboard.roleTip")}
              </p>
            </div>
          </div>
        )}
      </section>

      {(followedTopics.length > 0 || followedConcepts.length > 0) && (
        <section>
          <div className="section-header">
            <h2 className="section-title">{t("account.dashboard.following")}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {followedTopics.map((slug) => (
              <Link
                key={`t-${slug}`}
                href={`/topic/${slug}`}
                className="chip hover:border-[var(--accent)]"
              >
                {CATEGORY_MAP[slug] ? t(`category.${slug}`) : slug}
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
          <h2 className="section-title">{t("account.dashboard.recentlyRead")}</h2>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state py-10 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)]">
            <p className="text-[15px] text-[var(--text-primary)] mb-1">{t("account.dashboard.noRecentTitle")}</p>
            <p className="text-[13px]">{t("account.dashboard.noRecentBody")}</p>
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
                      {CATEGORY_MAP[entry.category] ? t(`category.${entry.category}`) : entry.category}
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
          <h2 className="section-title">{t("account.dashboard.howToEarn")}</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { action: t("account.dashboard.earnDecode"), pts: "+5", desc: t("account.dashboard.earnDecodeDesc") },
            { action: t("account.dashboard.earnJargon"), pts: "+10", desc: t("account.dashboard.earnJargonDesc") },
            { action: t("account.dashboard.earnTier"), pts: "+15", desc: t("account.dashboard.earnTierDesc") },
            { action: t("account.dashboard.earnCompare"), pts: "+20", desc: t("account.dashboard.earnCompareDesc") },
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
