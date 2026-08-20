"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"
import confetti from "canvas-confetti"
import zxcvbn from "zxcvbn"
import { supabase, updatePassword } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import {
  AuthShell,
  AuthError,
  PasswordInput,
} from "@/components/auth/AuthShell"

type PageState = "loading" | "ready" | "invalid" | "success"

const SCORE_COLORS = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"]
const SCORE_LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"]

function ScoreBar({ password }: { password: string }) {
  if (!password) return null
  const result = zxcvbn(password)
  const score = result.score
  const tip = result.feedback.warning || result.feedback.suggestions[0] || ""

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= score ? SCORE_COLORS[score] : "bg-[var(--border)]"
            }`}
          />
        ))}
      </div>
      <p className="text-[11px] text-[var(--text-secondary)]">
        {SCORE_LABELS[score]}
        {tip ? ` — ${tip}` : ""}
      </p>
    </div>
  )
}

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

function LoadingSkeleton({ message }: { message: string }) {
  return (
    <div className="text-center py-6">
      <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)]">
        <div className="h-7 w-7 rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)] animate-spin" />
      </div>
      <p className="text-[14px] text-[var(--text-secondary)] animate-card-in">{message}</p>
      <div className="mt-6 space-y-3">
        <div className="h-11 rounded-[var(--radius-sm)] bg-[var(--bg)] animate-pulse" />
        <div className="h-11 rounded-[var(--radius-sm)] bg-[var(--bg)] animate-pulse" />
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [pageState, setPageState] = useState<PageState>("loading")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const fireConfetti = useCallback(() => {
    const defaults = {
      spread: 360,
      ticks: 80,
      gravity: 0.8,
      decay: 0.94,
      startVelocity: 30,
      colors: ["#e53e3e", "#ff6b6b", "#ffa502", "#2ed573", "#1e90ff"],
    }
    confetti({ ...defaults, particleCount: 40, scalar: 1.2, shapes: ["circle"] })
    setTimeout(() => {
      confetti({ ...defaults, particleCount: 25, scalar: 0.8, shapes: ["circle"] })
    }, 150)
  }, [])

  useEffect(() => {
    let mounted = true
    let resolved = false

    function resolve(state: PageState) {
      if (!mounted || resolved) return
      resolved = true
      setPageState(state)
    }

    async function establishSession(): Promise<boolean> {
      const params = new URLSearchParams(window.location.search)
      const code = params.get("code")
      const tokenHash = params.get("token_hash")
      const type = params.get("type")

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) return false
        window.history.replaceState({}, "", "/reset-password")
        return true
      }

      if (tokenHash && type === "recovery") {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        })
        if (otpError) return false
        window.history.replaceState({}, "", "/reset-password")
        return true
      }

      const { data: { session } } = await supabase.auth.getSession()
      return !!session
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        resolve("ready")
      }
    })

    async function init() {
      const hasSession = await establishSession()
      if (hasSession) {
        resolve("ready")
        return
      }

      if (window.location.hash.includes("access_token")) {
        await new Promise((r) => setTimeout(r, 600))
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          window.history.replaceState({}, "", "/reset-password")
          resolve("ready")
          return
        }
      }

      resolve("invalid")
    }

    init()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password.length < 15) {
      setError("Password must be at least 15 characters")
      return
    }
    const strength = zxcvbn(password)
    if (strength.score < 3) {
      setError("Password is too weak. Try adding more words or avoiding common patterns")
      return
    }
    if (password !== confirmPassword) {
      setError(t("auth.errorPasswordsMatch"))
      return
    }

    setLoading(true)
    try {
      const { error: authError } = await updatePassword(password)
      if (authError) {
        setError(authError.error)
        return
      }
      setPageState("success")
      fireConfetti()
      setTimeout(() => {
        router.push("/account")
        router.refresh()
      }, 2200)
    } catch {
      setError(t("auth.errorGeneric"))
    } finally {
      setLoading(false)
    }
  }

  if (pageState === "loading") {
    return (
      <AuthShell title={t("auth.resetPageTitle")} subtitle={t("auth.resetPageSubtitle")}>
        <LoadingSkeleton message={t("auth.resetChecking")} />
      </AuthShell>
    )
  }

  if (pageState === "invalid") {
    return (
      <AuthShell
        title={t("auth.resetPageTitle")}
        subtitle={t("auth.resetInvalid")}
        footer={
          <Link href="/login" className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
            {t("auth.backToLogin")}
          </Link>
        }
      >
        <div className="text-center py-2">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)] animate-card-in">
            <AlertCircle className="h-7 w-7 text-[var(--accent)]" />
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] mb-6 max-w-[48ch] mx-auto">
            {t("auth.resetInvalid")}
          </p>
          <Link
            href="/forgot-password"
            className="btn-primary w-full h-11 inline-flex items-center justify-center"
          >
            {t("auth.requestNewLink")}
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (pageState === "success") {
    return (
      <AuthShell title={t("auth.resetPageTitle")} subtitle={t("auth.passwordUpdated")}>
        <div className="text-center py-4">
          <AnimatedCheckmark />
          <p className="text-[14px] text-[var(--text-primary)] font-semibold mb-1 animate-card-in">
            {t("auth.passwordUpdated")}
          </p>
          <p className="text-[13px] text-[var(--text-secondary)] animate-card-in-delayed">
            {t("auth.resetSuccessRedirect")}
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t("auth.resetPageTitle")} subtitle={t("auth.resetPageSubtitle")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1.5">{t("auth.newPassword")}</label>
          <PasswordInput
            required
            autoComplete="new-password"
            minLength={15}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 15 characters"
          />
          <ScoreBar password={password} />
        </div>

        <div>
          <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1.5">{t("auth.confirmNewPassword")}</label>
          <PasswordInput
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("auth.confirmNewPlaceholder")}
          />
          {passwordsMatch && (
            <p className="text-[11px] text-emerald-600 mt-1">{t("auth.passwordMatch")}</p>
          )}
          {passwordsMismatch && (
            <p className="text-[11px] text-[var(--accent)] mt-1">{t("auth.passwordMismatch")}</p>
          )}
        </div>

        <AuthError message={error} />

        <button
          type="submit"
          disabled={loading || passwordsMismatch}
          className="btn-primary w-full h-11 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("auth.updating")}
            </>
          ) : (
            t("auth.updatePassword")
          )}
        </button>
      </form>
    </AuthShell>
  )
}
