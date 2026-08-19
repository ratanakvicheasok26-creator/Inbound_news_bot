"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, X } from "lucide-react"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { useI18n } from "@/lib/i18n/LocaleProvider"

const SESSION_DISMISS_KEY = "promo_banner_dismissed_session"

export function PromoBanner() {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (typeof window === "undefined") return
      if (sessionStorage.getItem(SESSION_DISMISS_KEY) === "1") return

      if (!isSupabaseConfigured) {
        if (!cancelled) setVisible(true)
        return
      }

      try {
        const { data } = await supabase.auth.getSession()
        if (!cancelled && !data.session) {
          setVisible(true)
        }
      } catch {
        if (!cancelled) setVisible(true)
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1")
    } catch {}
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="banner"
          aria-label="Promotional banner"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-full overflow-hidden border-b bg-gradient-to-r from-[var(--surface-alt)] via-[var(--surface)] to-[var(--surface-alt)] border-[var(--border)]"
        >
          <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
            {/* Left: icon badge + title & subtitle */}
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF0030]/15 text-[#FF0030] ring-1 ring-[#FF0030]/30 sm:h-7 sm:w-7">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                <span className="text-xs font-bold text-[var(--text-primary)] sm:text-sm">
                  {t("promo.title")}
                </span>
                <span className="hidden text-xs text-[var(--text-secondary)] sm:inline-block">
                  — {t("promo.subtitle")}
                </span>
              </div>
            </div>

            {/* Right: CTA button + Dismiss X */}
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/signup"
                className="inline-flex h-7 items-center justify-center rounded-full bg-[#FF0030] px-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#d60028] hover:shadow-md sm:h-8 sm:px-4"
              >
                {t("promo.cta")}
              </Link>
              <button
                type="button"
                onClick={dismiss}
                aria-label={t("promo.dismiss")}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

