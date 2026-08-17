"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase, signOut } from "@/lib/auth"
import { getProfile, loadPreferencesFromSupabase } from "@/lib/profile"
import { ProfileTab } from "@/components/account/ProfileTab"
import { DashboardTab } from "@/components/account/DashboardTab"
import { LibraryTab } from "@/components/account/LibraryTab"
import { SettingsTab } from "@/components/account/SettingsTab"
import { MembershipTab } from "@/components/account/MembershipTab"
import { SyncSavesPrompt } from "@/components/account/SyncSavesPrompt"
import { PaymentSuccessModal } from "@/components/membership/PaymentSuccessModal"
import { getMembership, isActiveMembership, refreshAllMemberships } from "@/lib/membership"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import type { MembershipPlan } from "@/lib/plans"
import type { User } from "@supabase/supabase-js"

const tabIds = ["profile", "membership", "dashboard", "library", "settings"] as const
type TabId = (typeof tabIds)[number]

export default function AccountPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>("profile")
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [paidModal, setPaidModal] = useState<MembershipPlan | null>(null)
  const [paidNotice, setPaidNotice] = useState(false)
  const [profileTick, setProfileTick] = useState(0)
  const cleanupRef = useRef<(() => void) | null>(null)
  const profile = getProfile()
  const stealthOn = profile.preferences.stealthMode
  const hasSaves = profile.savedStoryIds.length > 0

  useEffect(() => {
    let mounted = true
    async function check() {
      const params = new URLSearchParams(window.location.search)
      if (params.get("tab") === "membership") setActiveTab("membership")
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      if (!mounted) return
      setUser(u)
      setLoading(false)
      if (u) {
        // Ensure profile row exists (trigger may not have run)
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", u.id)
          .maybeSingle()
        if (!existing) {
          await supabase.from("profiles").upsert(
            {
              id: u.id,
              display_name: u.user_metadata?.display_name || u.email?.split("@")[0] || "Reader",
            },
            { onConflict: "id" },
          )
        }
        await loadPreferencesFromSupabase()
      } else {
        router.replace("/login")
      }
      setProfileTick((t) => t + 1)
    }
    check()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadPreferencesFromSupabase().then(() => setProfileTick((t) => t + 1))
      } else {
        router.replace("/login")
      }
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  // Stripe checkout redirects here with ?paid=1. Poll until the webhook marks
  // the membership active — that's the proof of payment — then pop a
  // confirmation with the benefits just unlocked.
  const startPaidPolling = useCallback(() => {
    let cancelled = false
    let attempts = 0
    const timer = setInterval(async () => {
      attempts += 1
      const membership = await getMembership()
      if (cancelled) return
      if (membership && isActiveMembership(membership)) {
        clearInterval(timer)
        refreshAllMemberships()
        setPaidModal(membership.plan)
      } else if (attempts >= 20) {
        clearInterval(timer)
        setPaidNotice(true)
      }
    }, 2000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    if (params.get("paid") !== "1") return
    const url = new URL(window.location.href)
    url.searchParams.delete("paid")
    window.history.replaceState({}, "", url.toString())

    // Use a micro-delay so setState calls happen outside the synchronous effect body
    const raf = requestAnimationFrame(() => {
      setPaidNotice(false)
      setActiveTab("membership")
    })
    cleanupRef.current = startPaidPolling()
    return () => {
      cancelAnimationFrame(raf)
      cleanupRef.current?.()
    }
  }, [user, startPaidPolling])

  async function handleSignOut() {
    await signOut()
    setUser(null)
    router.push("/")
  }

  if (loading) {
    return (
      <div className="container py-16 text-center text-[var(--text-secondary)]">
        {t("account.loading")}
      </div>
    )
  }

  if (!user) {
    return null
  }

  const liveProfile = profileTick >= 0 ? getProfile() : profile
  const displayName =
    liveProfile.displayName ||
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    t("account.guestReader")

  return (
    <div className="container container-lg py-10 md:py-14">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title mb-2">{t("account.title")}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[14px] font-semibold">{displayName}</span>
            {user?.email ? (
              <span className="truncate text-[13px] text-[var(--text-secondary)]">
                {user.email}
              </span>
            ) : (
              <span className="text-[13px] text-[var(--text-secondary)]">
                {t("account.deviceOnly")}
              </span>
            )}
            {stealthOn && (
              <span className="meta-text text-[var(--accent)] bg-[var(--red-subtle-bg)] px-2 py-0.5 rounded-full">
                {t("account.stealth")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <span className="meta-text bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-full">
            {liveProfile.literacyScore} {t("account.pts")}
          </span>
          {user ? (
            <button type="button" onClick={handleSignOut} className="btn-ghost">
              {t("account.signOut")}
            </button>
          ) : (
            <Link href="/login" className="btn-primary text-[13px] h-9 px-4">
              {t("account.signIn")}
            </Link>
          )}
        </div>
      </div>

      {!user && hasSaves && (
        <SyncSavesPrompt variant="banner" force />
      )}

      {paidNotice && (
        <div className="mb-6 max-w-md p-4 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] border border-[var(--border)] text-[13px] text-[var(--text-primary)]">
          <p className="mb-3">{t("account.paidNotice")}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                cleanupRef.current?.()
                cleanupRef.current = startPaidPolling()
              }}
              className="btn-primary text-[13px] h-8 px-4"
            >
              {t("account.checkAgain")}
            </button>
            <Link
              href="/account?tab=membership"
              onClick={() => setActiveTab("membership")}
              className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)]"
            >
              {t("account.viewMembership")}
            </Link>
          </div>
        </div>
      )}

      {paidModal && (
        <PaymentSuccessModal plan={paidModal} onClose={() => setPaidModal(null)} />
      )}

      <nav
        className="mb-8 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-[var(--border)]"
        role="tablist"
        aria-label={t("account.accountSections")}
      >
        {tabIds.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`shrink-0 -mb-px whitespace-nowrap border-b-2 px-3 sm:px-4 py-2.5 text-[13px] sm:text-[14px] font-semibold transition-colors ${
              activeTab === id
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t(`account.tabs.${id}`)}
          </button>
        ))}
      </nav>

      {activeTab === "profile" && user && <ProfileTab user={user} />}
      {activeTab === "membership" && <MembershipTab />}
      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "library" && <LibraryTab />}
      {activeTab === "settings" && (
        <SettingsTab user={user} onSignOut={handleSignOut} />
      )}
    </div>
  )
}
