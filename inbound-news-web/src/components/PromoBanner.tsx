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
    return () => { cancelled = true }
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
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative z-10 w-full border-b"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-5 sm:py-2.5 md:px-8">
            {/* Left: icon + text */}
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <span className="promo-pulse-glow flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)] sm:h-4 sm:w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold leading-tight text-[var(--text-primary)] sm:text-sm">
                  {t("promo.title")}
                </p>
                <p className="hidden truncate text-xs leading-snug text-[var(--text-secondary)] md:block">
                  {t("promo.subtitle")}
                </p>
              </div>
            </div>

            {/* Right: CTA + close */}
            <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
              <Link
                href="/signup"
                className="promo-shimmer-btn btn-primary h-7 rounded-full bg-gradient-to-r from-[var(--accent)] via-[#ff4d6d] to-[var(--accent)] px-3 text-[11px] font-bold text-white shadow-md transition-transform hover:scale-105 sm:h-8 sm:px-4 sm:text-xs"
              >
                {t("promo.cta")}
              </Link>
              <button
                onClick={dismiss}
                aria-label={t("promo.dismiss")}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)] sm:h-7 sm:w-7"
              >
                <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
