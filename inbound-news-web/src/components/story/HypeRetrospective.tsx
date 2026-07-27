"use client"

import { useEffect, useState, useRef } from "react"
import { AlertTriangle, Clock, CheckCircle, XCircle, MinusCircle } from "lucide-react"

interface Prediction {
  storyId: string
  title: string
  verdict: "hyped" | "will_deliver" | "too_early"
  createdAt: string
}

interface HypeRetrospectiveProps {
  storyId: string
  storyTitle: string
  createdAt: string
}

const SEED_PREDS: Prediction[] = [
  { storyId: "seed-1", title: "GPT-5 will pass the bar exam with 95% accuracy", verdict: "hyped", createdAt: "2025-11-15" },
  { storyId: "seed-2", title: "Quantum computing will break RSA encryption by 2026", verdict: "hyped", createdAt: "2025-09-03" },
  { storyId: "seed-3", title: "Apple Vision Pro will redefine workplace productivity", verdict: "hyped", createdAt: "2025-06-20" },
  { storyId: "seed-4", title: "Open source models will match GPT-4 by end of 2025", verdict: "will_deliver", createdAt: "2025-08-12" },
  { storyId: "seed-5", title: "Cambodia will launch a national AI strategy by 2026", verdict: "will_deliver", createdAt: "2025-10-01" },
]

const VERDICT_ICONS = {
  hyped: XCircle,
  will_deliver: CheckCircle,
  too_early: MinusCircle,
}

const VERDICT_LABELS = {
  hyped: "Overhyped",
  will_deliver: "Will deliver",
  too_early: "Too early to tell",
}

const VERDICT_COLORS = {
  hyped: "text-[var(--red-alert)]",
  will_deliver: "text-[var(--green-substance)]",
  too_early: "text-[var(--text-secondary)]",
}

function getCheckInDate(createdAt: string): Date {
  const d = new Date(createdAt)
  d.setDate(d.getDate() + 90)
  return d
}

function daysUntil(date: Date): number {
  const now = new Date()
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const STORAGE_KEY = "hype_predictions"

function loadPredictions(): Prediction[] {
  if (typeof window === "undefined") return SEED_PREDS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PREDS))
      return SEED_PREDS
    }
    const stored = JSON.parse(raw) as Prediction[]
    if (stored.length === 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PREDS))
      return SEED_PREDS
    }
    return stored
  } catch {
    return SEED_PREDS
  }
}

function savePrediction(pred: Prediction) {
  try {
    const all = loadPredictions()
    const filtered = all.filter((p) => p.storyId !== pred.storyId)
    filtered.unshift(pred)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch {}
}

export function HypeRetrospective({ storyId, storyTitle, createdAt }: HypeRetrospectiveProps) {
  const [myVote, setMyVote] = useState<"hyped" | "will_deliver" | "too_early" | null>(null)
  const [pastPredictions, setPastPredictions] = useState<Prediction[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const fetched = useRef(false)

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true
    const all = loadPredictions()
    const existing = all.find((p) => p.storyId === storyId)
    if (existing) setMyVote(existing.verdict)
    setPastPredictions(all.filter((p) => p.storyId !== storyId))
  }, [storyId])

  const checkIn = getCheckInDate(createdAt)
  const days = daysUntil(checkIn)
  const isPastDue = days <= 0

  function handleVote(verdict: "hyped" | "will_deliver" | "too_early") {
    setMyVote(verdict)
    savePrediction({ storyId, title: storyTitle, verdict, createdAt: new Date().toISOString() })
  }

  const hypeCount = pastPredictions.filter((p) => p.verdict === "hyped").length
  const totalCount = pastPredictions.length || 1
  const hypeRate = Math.round((hypeCount / totalCount) * 100)

  return (
    <section className="py-6 border-b border-[var(--border)]">
      <div className="flex items-start gap-3 p-4 bg-[var(--red-subtle-bg)] border-l-2 border-[var(--red-alert)]">
        <AlertTriangle className="h-4 w-4 text-[var(--red-alert)] mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--red-subtle-text)]">
              Hype Retrospective
            </p>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-3 w-3 text-[var(--text-secondary)]" />
            <span className="font-mono text-[11px] text-[var(--text-secondary)]">
              {isPastDue ? (
                <>Check-in was due {formatDateShort(checkIn)}</>
              ) : (
                <>Check-in in {days} days — {formatDateShort(checkIn)}</>
              )}
            </span>
          </div>

          <div className="mb-3">
            <p className="text-[12px] text-[var(--text-secondary)] mb-2">
              What do you think — will this deliver on its promise?
            </p>
            <div className="flex gap-2 flex-wrap">
              {(["hyped", "will_deliver", "too_early"] as const).map((v) => {
                const Icon = VERDICT_ICONS[v]
                const active = myVote === v
                return (
                  <button
                    key={v}
                    onClick={() => handleVote(v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border transition-all ${
                      active
                        ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg)]"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {VERDICT_LABELS[v]}
                  </button>
                )
              })}
            </div>
          </div>

          {pastPredictions.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {showHistory ? "Hide" : "Show"} track record ({pastPredictions.length} past predictions)
              </button>

              {showHistory && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                      {hypeRate}% of past predictions voted "overhyped"
                    </span>
                    <div className="flex-1 h-[2px] bg-[var(--border)]">
                      <div
                        className="h-full bg-[var(--red-alert)]"
                        style={{ width: `${hypeRate}%` }}
                      />
                    </div>
                  </div>
                  {pastPredictions.slice(0, 5).map((p, i) => {
                    const Icon = VERDICT_ICONS[p.verdict]
                    return (
                      <div key={i} className="flex items-start gap-2 text-[11px]">
                        <Icon className={`h-3 w-3 mt-0.5 shrink-0 ${VERDICT_COLORS[p.verdict]}`} />
                        <span className="text-[var(--text-secondary)] line-clamp-1">{p.title}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
