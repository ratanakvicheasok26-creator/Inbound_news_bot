"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import { AuthShell } from "@/components/auth/AuthShell"

export default function ConfirmPage() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")

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
          setTimeout(() => {
            router.push("/account")
            router.refresh()
          }, 1500)
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
  }, [searchParams, router, t])

  return (
    <AuthShell title={t("auth.confirmTitle")} subtitle={t("auth.confirmSubtitle")}>
      {status === "loading" && (
        <div className="text-center py-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
          <p className="mt-4 text-[14px] text-[var(--text-secondary)]">{t("auth.confirming")}</p>
        </div>
      )}

      {status === "success" && (
        <div className="text-center py-4">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)]">
            <CheckCircle className="h-7 w-7 text-[var(--accent)]" />
          </div>
          <p className="text-[14px] text-[var(--text-primary)] font-semibold mb-1">
            {t("auth.confirmSuccess")}
          </p>
          <p className="text-[13px] text-[var(--text-secondary)]">
            {t("auth.redirectingToAccount")}
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="text-center py-4">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)]">
            <AlertCircle className="h-7 w-7 text-[var(--accent)]" />
          </div>
          <p className="text-[14px] text-[var(--text-primary)] font-semibold mb-1">
            {t("auth.confirmFailed")}
          </p>
          <p className="text-[13px] text-[var(--text-secondary)] mb-6 max-w-[48ch] mx-auto">
            {errorMsg}
          </p>
          <div className="space-y-3">
            <Link
              href="/login"
              className="btn-primary w-full h-11 inline-flex items-center justify-center"
            >
              {t("auth.goToSignIn")}
            </Link>
            <Link
              href="/signup"
              className="block text-center text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)]"
            >
              {t("auth.tryAgain")}
            </Link>
          </div>
        </div>
      )}
    </AuthShell>
  )
}
