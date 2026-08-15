"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase, updatePassword, signOut } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import {
  AuthShell,
  AuthError,
  AuthSuccess,
  PasswordInput,
} from "@/components/auth/AuthShell"

export default function ResetPasswordPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    let mounted = true
    async function checkSession() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      if (data.session) setReady(true)
    }
    checkSession()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === "PASSWORD_RECOVERY" && session) setReady(true)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (password.length < 8) {
      setError(t("auth.errorPasswordMin"))
      return
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError(t("auth.errorPasswordWeak"))
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
        setError(authError.message)
        return
      }
      await signOut()
      setSuccess(t("auth.passwordUpdated"))
      setTimeout(() => router.push("/login"), 1200)
    } catch {
      setError(t("auth.errorGeneric"))
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <AuthShell title={t("auth.resetPageTitle")} subtitle={t("auth.resetPageSubtitle")}>
        <AuthError message={error || t("auth.resetInvalid")} />
        <div className="mt-4 text-center">
          <Link
            href="/forgot-password"
            className="text-[13px] font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]"
          >
            {t("auth.requestNewLink")}
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t("auth.resetPageTitle")} subtitle={t("auth.resetPageSubtitle")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="meta-text block mb-2">{t("auth.newPassword")}</label>
          <PasswordInput
            required
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.passwordHint")}
          />
        </div>

        <div>
          <label className="meta-text block mb-2">{t("auth.confirmNewPassword")}</label>
          <PasswordInput
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("auth.confirmNewPlaceholder")}
          />
        </div>

        <AuthError message={error} />
        <AuthSuccess message={success} />

        <button type="submit" disabled={loading} className="btn-primary w-full h-11 disabled:opacity-50">
          {loading ? t("auth.updating") : t("auth.updatePassword")}
        </button>
      </form>
    </AuthShell>
  )
}
