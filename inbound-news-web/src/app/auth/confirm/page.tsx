"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AuthShell, AuthError, AuthSuccess } from "@/components/auth/AuthShell"

export default function ConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function handleConfirm() {
      const code = searchParams.get("code")
      const errorParam = searchParams.get("error")
      const errorDescription = searchParams.get("error_description")

      if (errorParam) {
        if (mounted) {
          setError(errorDescription || "Email confirmation failed. Please try again or request a new link.")
          setLoading(false)
        }
        return
      }

      if (!code) {
        if (mounted) {
          setError("No confirmation code found. Please use the link from your email.")
          setLoading(false)
        }
        return
      }

      try {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (!mounted) return

        if (exchangeError) {
          setError(exchangeError.message || "Email confirmation failed. The link may have expired.")
          setLoading(false)
        } else {
          setSuccess("Email confirmed! Redirecting…")
          setLoading(false)
          router.push("/account")
          router.refresh()
        }
      } catch {
        if (!mounted) return
        setError("Something went wrong during confirmation. Please try signing in.")
        setLoading(false)
      }
    }

    handleConfirm()

    return () => {
      mounted = false
    }
  }, [searchParams, router])

  return (
    <AuthShell title="Email confirmation" subtitle="Verifying your email address…">
      {loading && (
        <div className="text-center py-4">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
          <p className="mt-3 text-[14px] text-[var(--text-secondary)]">Confirming your email…</p>
        </div>
      )}

      <AuthError message={error} />
      <AuthSuccess message={success} />

      {error && (
        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="text-[13px] font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]"
          >
            Go to sign in
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
