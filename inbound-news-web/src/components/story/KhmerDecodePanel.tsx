"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Languages, Lock, Loader2, X } from "lucide-react"
import { useMembership, getAccessToken } from "@/lib/membership"
import { effectiveTier } from "@/lib/access"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import type { KhmerContent } from "@/lib/khmer-content"

/**
 * Khmer Decode panel on the story page.
 *
 * The Khmer UI is free; this panel surfaces AI-generated Khmer content gated
 * by the user's plan:
 *   Free    → basic Khmer summary + upgrade prompt
 *   Member  → full Khmer Decode of every source (monthly or annual)
 */
export function KhmerDecodePanel({ storyId }: { storyId: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const { loading, membership } = useMembership()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [content, setContent] = useState<KhmerContent | null>(null)

  const tier = effectiveTier(membership)
  const isFree = tier === "free"

  async function load() {
    setBusy(true)
    setError("")
    try {
      const token = await getAccessToken()
      if (!token) {
        router.push(`/login?returnTo=/story/${storyId}`)
        return
      }
      const res = await fetch(`/api/story/${storyId}/khmer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = (await res.json().catch(() => ({}))) as { content?: KhmerContent; error?: string }
      if (!res.ok || !data?.content) {
        setError(
          data?.error === "rate_limited" ? t("story.khmerError") : t("story.khmerError")
        )
        setOpen(true)
        return
      }
      setContent(data.content)
      setOpen(true)
    } catch {
      setError(t("story.khmerError"))
      setOpen(true)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="h-10 w-44 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] animate-pulse" aria-hidden />
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={load}
        disabled={busy}
        className="inline-flex items-center gap-1.5 h-10 px-4 text-[13px] font-semibold rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors font-khmer disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Languages className="h-4 w-4" />
        )}
        {busy ? t("story.khmerLoading") : t("story.readInKhmer")}
      </button>
    )
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 font-khmer">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Languages className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span className="meta-text font-semibold text-[var(--accent)]">
            {content?.level === "full" ? t("story.khmerDecode") : t("story.khmerBasic")}
          </span>
          <span className="inline-flex text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] border border-[var(--border)] rounded-full px-2 py-0.5">
            ភាសាខ្មែរ
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t("common.close")}
          className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error ? (
        <p className="text-[13px] text-[var(--text-primary)]">{error}</p>
      ) : busy && !content ? (
        <div className="space-y-2 animate-pulse" aria-hidden>
          <div className="h-5 w-3/4 rounded bg-[var(--surface-alt)]" />
          <div className="h-4 w-full rounded bg-[var(--surface-alt)]" />
          <div className="h-4 w-5/6 rounded bg-[var(--surface-alt)]" />
        </div>
      ) : content ? (
        <>
          <h3 className="text-[20px] sm:text-[22px] font-semibold leading-snug mb-3 [overflow-wrap:anywhere]">
            {content.title}
          </h3>
          <p className="text-[15px] sm:text-[16px] leading-[1.75] text-[var(--text-primary)] [overflow-wrap:anywhere]">
            {content.body}
          </p>

          {content.articles.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="meta-text mb-1">{t("story.khmerArticleN")}</p>
              {content.articles.map((a) => (
                <p key={a.id} className="text-[13px] text-[var(--text-secondary)] leading-relaxed [overflow-wrap:anywhere]">
                  <span className="font-semibold text-[var(--text-primary)]">{a.title}</span>
                  {a.summary ? ` — ${a.summary}` : ""}
                </p>
              ))}
            </div>
          )}

          {isFree && (
            <div className="mt-5 rounded-[var(--radius-sm)] border border-[var(--accent)] bg-[var(--red-subtle-bg)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span className="text-[12px] font-semibold text-[var(--accent)]">
                  {t("membership.membersOnlyBadge")}
                </span>
              </div>
              <p className="text-[13px] text-[var(--text-primary)] mb-3">{t("story.khmerUnlockFull")}</p>
              <Link href="/pricing" className="btn-primary w-full sm:w-auto text-[13px] px-4 py-2 inline-flex">
                {t("membership.viewPlans")}
              </Link>
            </div>
          )}

          <p className="mt-4 text-[11px] text-[var(--text-secondary)]">
            {t("story.khmerGenerated")}
          </p>
        </>
      ) : null}
    </div>
  )
}
