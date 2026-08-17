"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle } from "lucide-react"
import confetti from "canvas-confetti"
import { supabase } from "@/lib/supabase"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import { AuthShell } from "@/components/auth/AuthShell"

function AnimatedCheckmark() {
  return (
    <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)] animate-card-in">
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" opacity="0.2" />
        <path className="animate-checkmark" d="M7 12.5l3.5 3.5 6.5-7" />
      </svg>
    </div>
  )
}

export default function ConfirmPage() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")

  const fireConfetti = useCallback(() => {
    const defaults = { spread: 360, ticks: 80, gravity: 0.8, decay: 0.94, startVelocity: 30, colors: ["#e53e3e", "#ff6b6b", "#ffa502", "#2ed573", "#1e90ff"] }
    confetti({ ...defaults, particleCount: 40, scalar: 1.2, shapes: ["circle"] })
    setTimeout(() => {
      confetti({ ...defaults, particleCount: 25, scalar: 0.8, shapes: ["circle"] })
    }, 150)
  }, [])

  useEffect(() => {
    let mounted = true

    async function handleConfirm() {
      const code = searchParams.get("code")
      const errorParam = searchParams.get("error")
      const errorDescription = searchParams.get("error_description")

      if (errorParam) {
        if (mounted) {
          setErrorMsg(errorDescription || t("auth.confirmError"))
          setStatus("error")
        }
        return
      }

      if (!code) {
        if (mounted) {
          setErrorMsg(t("auth.confirmNoCode"))
          setStatus("error")
        }
        return
      }

      try {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (!mounted) return

        if (exchangeError) {
          setErrorMsg(exchangeError.message || t("auth.confirmError"))
          setStatus("error")
        } else {
          setStatus("success")
          fireConfetti()
          setTimeout(() => {
            router.push("/account?welcome=1")
            router.refresh()
          }, 2000)
        }
      } catch {
        if (!mounted) return
        setErrorMsg(t("auth.confirmGenericError"))
        setStatus("error")
      }
    }

    handleConfirm()

    return () => {
      mounted = false
    }
  }, [searchParams, router, t, fireConfetti])

  return (
    <AuthShell
      title={t("auth.confirmTitle")}
      subtitle={t("auth.confirmSubtitle")}
      footer={
        <Link href="/login" className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
          {t("auth.goToSignIn")}
        </Link>
      }
    >
      {status === "loading" && (
        <div className="text-center py-4">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)]">
            <div className="h-7 w-7 rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)] animate-spin" />
          </div>
          <p className="text-[14px] text-[var(--text-secondary)] animate-card-in">{t("auth.confirming")}</p>
        </div>
      )}

      {status === "success" && (
        <div className="text-center py-4">
          <AnimatedCheckmark />
          <p className="text-[14px] text-[var(--text-primary)] font-semibold mb-1 animate-card-in">
            {t("auth.confirmSuccess")}
          </p>
          <p className="text-[13px] text-[var(--text-secondary)] animate-card-in-delayed">
            {t("auth.redirectingToAccount")}
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="text-center py-4">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)] animate-card-in">
            <AlertCircle className="h-7 w-7 text-[var(--accent)]" />
          </div>
          <p className="text-[14px] text-[var(--text-primary)] font-semibold mb-1 animate-card-in">
            {t("auth.confirmFailed")}
          </p>
          <p className="text-[13px] text-[var(--text-secondary)] mb-4 max-w-[48ch] mx-auto animate-card-in-delayed">
            {errorMsg}
          </p>
          <Link
            href="/signup"
            className="btn-primary w-full h-11 inline-flex items-center justify-center animate-card-in-delayed"
          >
            {t("auth.tryAgain")}
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
