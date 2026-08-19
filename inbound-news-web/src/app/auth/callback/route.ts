import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-route"

/**
 * Handles Supabase Auth callbacks:
 * - Email confirmation: ?code=...
 * - Password recovery: ?code=...
 * - Magic link: ?code=...
 * - OAuth: ?code=...&state=...
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as "signup" | "recovery" | "invite" | "magiclink" | "email" | null
  const next = searchParams.get("next") || "/account"
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  if (error) {
    const errorUrl = new URL("/auth/confirm", origin)
    errorUrl.searchParams.set("error", error)
    if (errorDescription) {
      errorUrl.searchParams.set("error_description", errorDescription)
    }
    return NextResponse.redirect(errorUrl)
  }

  if (!code && !tokenHash) {
    const errorUrl = new URL("/auth/confirm", origin)
    errorUrl.searchParams.set("error", "missing_code")
    errorUrl.searchParams.set("error_description", "No verification code or token found in the request link.")
    return NextResponse.redirect(errorUrl)
  }

  try {
    const supabase = await createServerClient()
    let exchangeError = null

    if (code) {
      const { error: err } = await supabase.auth.exchangeCodeForSession(code)
      exchangeError = err
    } else if (tokenHash && type) {
      const { error: err } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type,
      })
      exchangeError = err
    }

    if (exchangeError) {
      console.error("[Auth Callback] Exchange error:", exchangeError.message)
      const errorUrl = new URL("/auth/confirm", origin)
      errorUrl.searchParams.set("error", "confirmation_failed")
      errorUrl.searchParams.set("error_description", exchangeError.message)
      return NextResponse.redirect(errorUrl)
    }

    const forwardedHost = req.headers.get("x-forwarded-host")
    const isLocalEnv = process.env.NODE_ENV === "development"

    const redirectPath = next.startsWith("/") ? next : "/account"
    if (isLocalEnv) {
      return NextResponse.redirect(`${origin}${redirectPath}`)
    } else if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${redirectPath}`)
    } else {
      return NextResponse.redirect(`${origin}${redirectPath}`)
    }
  } catch (e) {
    console.error("[Auth Callback] Unexpected error:", e)
    return NextResponse.redirect(new URL("/login", origin))
  }
}
