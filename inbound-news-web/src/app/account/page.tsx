"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { User, CreditCard, BarChart3, BookOpen, Settings, LogOut } from "lucide-react"
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
import type { User as SupabaseUser } from "@supabase/supabase-js"

const tabIds = ["profile", "membership", "dashboard", "library", "settings"] as const
type TabId = (typeof tabIds)[number]

const tabIcons: Record<TabId, typeof User> = {
  profile: User,
  membership: CreditCard,
  dashboard: BarChart3,
  library: BookOpen,
  settings: Settings,
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase()
}

export default function AccountPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>("profile")
  const [user, setUser] = useState<SupabaseUser | null>(null)
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
  const initial = getInitial(displayName)

  return (
    <div className="container container-lg py-8 md:py-12">
      {/* Mobile: top card with avatar + name */}
      <div className="md:hidden mb-6">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center text-[18px] font-bold shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate">{displayName}</p>
              <p className="text-[13px] text-[var(--text-secondary)] truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="meta-text bg-[var(--surface-alt)] border border-[var(--border)] px-2.5 py-1 rounded-full text-[12px]">
              {liveProfile.literacyScore} {t("account.pts")}
            </span>
            {stealthOn && (
              <span className="meta-text text-[var(--accent)] bg-[var(--red-subtle-bg)] px-2.5 py-1 rounded-full text-[12px]">
                {t("account.stealth")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: tabs */}
      <nav
        className="md:hidden mb-6 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-[var(--border)]"
        role="tablist"
        aria-label={t("account.accountSections")}
      >
        {tabIds.map((id) => {
          const Icon = tabIcons[id]
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`shrink-0 -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                activeTab === id
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(`account.tabs.${id}`)}
            </button>
          )
        })}
      </nav>

      <div className="flex gap-8">
        {/* Desktop: sidebar */}
        <aside className="hidden md:block w-56 shrink-0">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 sticky top-24">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[var(--border)]">
              <div className="w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center text-[16px] font-bold shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{displayName}</p>
                <p className="text-[12px] text-[var(--text-secondary)] truncate">{user.email}</p>
              </div>
            </div>

            <nav className="space-y-0.5" role="tablist" aria-label={t("account.accountSections")}>
              {tabIds.map((id) => {
                const Icon = tabIcons[id]
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === id}
                    onClick={() => setActiveTab(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[14px] font-medium transition-colors ${
                      activeTab === id
                        ? "bg-[var(--accent)] bg-opacity-10 text-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {t(`account.tabs.${id}`)}
                  </button>
                )
              })}
            </nav>

            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-2">
                <span className="meta-text text-[12px]">
                  {liveProfile.literacyScore} {t("account.pts")}
                </span>
                {stealthOn && (
                  <span className="meta-text text-[var(--accent)] text-[12px]">
                    {t("account.stealth")}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[14px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--red-subtle-bg)] transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {t("account.signOut")}
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {paidNotice && (
            <div className="mb-6 p-4 rounded-2xl bg-[var(--surface-alt)] border border-[var(--border)] text-[13px] text-[var(--text-primary)]">
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

          {!user && hasSaves && (
            <SyncSavesPrompt variant="banner" force />
          )}

          {paidModal && (
            <PaymentSuccessModal plan={paidModal} onClose={() => setPaidModal(null)} />
          )}

          {activeTab === "profile" && user && <ProfileTab user={user} />}
          {activeTab === "membership" && <MembershipTab />}
          {activeTab === "dashboard" && <DashboardTab />}
          {activeTab === "library" && <LibraryTab />}
          {activeTab === "settings" && (
            <SettingsTab user={user} onSignOut={handleSignOut} />
          )}
        </main>
      </div>
    </div>
  )
}
