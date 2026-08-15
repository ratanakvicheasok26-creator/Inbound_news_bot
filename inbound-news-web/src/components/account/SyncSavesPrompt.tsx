"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  dismissSyncPrompt,
  hasSyncPromptPending,
  isSyncPromptDismissed,
} from "@/lib/sync-prompt"
import { useI18n } from "@/lib/i18n/LocaleProvider"

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
  const { t } = useI18n()
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
        {t("account.syncPrompt.title")}
      </p>
      <p className="text-[13px] text-[var(--text-secondary)] mb-3 max-w-[52ch]">
        {t("account.syncPrompt.body")}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/login" className="btn-primary text-[13px] h-9 px-4">
          {t("account.signIn")}
        </Link>
        <button
          type="button"
          onClick={() => {
            dismissSyncPrompt()
            setVisible(false)
          }}
          className="text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)]"
        >
          {t("account.syncPrompt.notNow")}
        </button>
      </div>
    </div>
  )
}
