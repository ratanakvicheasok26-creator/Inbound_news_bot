"use client"

import { useState, useEffect } from "react"
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
import { getMembership, isActiveMembership } from "@/lib/membership"
import type { MembershipPlan } from "@/lib/plans"
import type { User } from "@supabase/supabase-js"

const tabs = [
  { id: "profile" as const, label: "Profile" },
  { id: "membership" as const, label: "Membership" },
  { id: "dashboard" as const, label: "Dashboard" },
  { id: "library" as const, label: "Library" },
  { id: "settings" as const, label: "Settings" },
]

export default function AccountPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<
    "profile" | "membership" | "dashboard" | "library" | "settings"
  >("profile")
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [paidModal, setPaidModal] = useState<MembershipPlan | null>(null)
  const [paidNotice, setPaidNotice] = useState(false)
  const [profileTick, setProfileTick] = useState(0)
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
  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    if (params.get("paid") !== "1") return
    const url = new URL(window.location.href)
    url.searchParams.delete("paid")
    window.history.replaceState({}, "", url.toString())

    let cancelled = false
    let attempts = 0
    const timer = setInterval(async () => {
      attempts += 1
      const membership = await getMembership()
      if (cancelled) return
      if (membership && isActiveMembership(membership)) {
        clearInterval(timer)
        setPaidModal(membership.plan)
      } else if (attempts >= 15) {
        clearInterval(timer)
        setPaidNotice(true)
      }
    }, 2000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [user])

  async function handleSignOut() {
    await signOut()
    setUser(null)
    router.push("/")
  }

  if (loading) {
    return (
      <div className="container py-16 text-center text-[var(--text-secondary)]">
        Loading…
      </div>
    )
  }

  if (!user) {
    return null
  }

  const displayName = user?.email?.split("@")[0] || "Guest Reader"
  const liveProfile = profileTick >= 0 ? getProfile() : profile

  return (
    <div className="container container-lg py-10 md:py-14">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title mb-2">Account</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[14px] font-semibold">{displayName}</span>
            {user?.email ? (
              <span className="truncate text-[13px] text-[var(--text-secondary)]">
                {user.email}
              </span>
            ) : (
              <span className="text-[13px] text-[var(--text-secondary)]">
                On this device · no sign-in required
              </span>
            )}
            {stealthOn && (
              <span className="meta-text text-[var(--accent)] bg-[var(--red-subtle-bg)] px-2 py-0.5 rounded-full">
                Stealth
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <span className="meta-text bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-full">
            {liveProfile.literacyScore} pts
          </span>
          {user ? (
            <button type="button" onClick={handleSignOut} className="btn-ghost">
              Sign out
            </button>
          ) : (
            <Link href="/login" className="btn-primary text-[13px] h-9 px-4">
              Sign in
            </Link>
          )}
        </div>
      </div>

      {!user && hasSaves && (
        <SyncSavesPrompt variant="banner" force />
      )}

      {paidNotice && (
        <div className="mb-6 max-w-md p-3 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] border border-[var(--border)] text-[13px] text-[var(--text-primary)]">
          Payment successful — you’re now a Pro/Premium member. Premium stories unlock as
          soon as Stripe confirms your subscription.
        </div>
      )}

      {paidModal && (
        <PaymentSuccessModal plan={paidModal} onClose={() => setPaidModal(null)} />
      )}

      <nav
        className="mb-8 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-[var(--border)]"
        role="tablist"
        aria-label="Account sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 -mb-px whitespace-nowrap border-b-2 px-3 sm:px-4 py-2.5 text-[13px] sm:text-[14px] font-semibold transition-colors ${
              activeTab === tab.id
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab.label}
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
