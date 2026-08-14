"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  dismissSyncPrompt,
  hasSyncPromptPending,
  isSyncPromptDismissed,
} from "@/lib/sync-prompt"

/**
 * Soft CTA: sign in to sync preferences. Saves/library stay on-device for now.
 * Only shows for guests who have saved something (or just saved).
 */
export function SyncSavesPrompt({
  variant = "banner",
  force = false,
}: {
  variant?: "banner" | "inline"
  /** Show when guest has saves even without pending flag (Library). */
  force?: boolean
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function refresh() {
      if (isSyncPromptDismissed()) {
        setVisible(false)
        return
      }
      setVisible(force || hasSyncPromptPending())
    }
    refresh()
    window.addEventListener("inbound:sync-prompt", refresh)
    return () => window.removeEventListener("inbound:sync-prompt", refresh)
  }, [force])

  if (!visible) return null

  const box =
    variant === "inline"
      ? "mb-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
      : "mb-6 rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--red-subtle-bg)] p-4"

  return (
    <div className={box} role="status">
      <p className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
        Sign in to sync reading preferences
      </p>
      <p className="text-[13px] text-[var(--text-secondary)] mb-3 max-w-[52ch]">
        Saves, score, and library stay on this device. An account syncs tier and settings across
        browsers — full library sync comes later.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/login" className="btn-primary text-[13px] h-9 px-4">
          Sign in
        </Link>
        <button
          type="button"
          onClick={() => {
            dismissSyncPrompt()
            setVisible(false)
          }}
          className="text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)]"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
