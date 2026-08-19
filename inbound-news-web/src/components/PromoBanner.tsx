"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, X } from "lucide-react"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { useI18n } from "@/lib/i18n/LocaleProvider"

const DISMISS_KEY = "promo_banner_dismissed"

export function PromoBanner() {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (typeof window === "undefined") return
      if (localStorage.getItem(DISMISS_KEY) === "1") return

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
      localStorage.setItem(DISMISS_KEY, "1")
    } catch {}
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="banner"
          aria-label="Promotional banner"
          initial={{ y: -64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -64, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative z-[60] w-full border-b"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          <div className="mx-auto flex max-w-[var(--container-max)] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="promo-pulse-glow flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--red-subtle-bg)]">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-tight text-[var(--text-primary)] sm:text-[14px]">
                  {t("promo.title")}
                </p>
                <p className="hidden text-[12px] leading-snug text-[var(--text-secondary)] sm:block">
                  {t("promo.subtitle")}
                </p>
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-2">
              <Link
                href="/signup"
                className="promo-shimmer-btn btn-primary h-8 rounded-full bg-gradient-to-r from-[var(--accent)] via-[#ff4d6d] to-[var(--accent)] px-4 text-[12px] font-bold text-white shadow-md transition-transform hover:scale-105"
              >
                {t("promo.cta")}
              </Link>
              <button
                onClick={dismiss}
                aria-label={t("promo.dismiss")}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
