"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { User, CreditCard, BarChart3, BookOpen, Settings, LogOut, Shield, Newspaper, UserCircle } from "lucide-react"
import { supabase, signOut, getCurrentUser, extractAuthUser, type AuthUser } from "@/lib/auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getProfile, loadPreferencesFromSupabase } from "@/lib/profile"
import { ProfileTab } from "@/components/account/editorial/ProfileTab"
import { PersonalInfoTab } from "@/components/account/editorial/PersonalInfoTab"
import { PreferencesTab } from "@/components/account/editorial/PreferencesTab"
import { SecurityTab } from "@/components/account/editorial/SecurityTab"
import { DashboardTab } from "@/components/account/DashboardTab"
import { LibraryTab } from "@/components/account/LibraryTab"
import { SettingsTab } from "@/components/account/SettingsTab"
import { MembershipTab } from "@/components/account/MembershipTab"
import { SyncSavesPrompt } from "@/components/account/SyncSavesPrompt"
import { PaymentSuccessModal } from "@/components/membership/PaymentSuccessModal"
import { getMembership, isActiveMembership, refreshAllMemberships } from "@/lib/membership"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { MembershipPlan } from "@/lib/plans"

const tabIds = ["profile", "personal", "preferences", "security", "membership", "dashboard", "library", "settings"] as const
type TabId = (typeof tabIds)[number]

const tabIcons: Record<TabId, typeof User> = {
  profile: UserCircle,
  personal: User,
  preferences: Newspaper,
  security: Shield,
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
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [paidModal, setPaidModal] = useState<MembershipPlan | null>(null)
  const [paidNotice, setPaidNotice] = useState(false)
  const [profileTick, setProfileTick] = useState(0)
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState<string>("")
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("welcome") === "1") {
      const url = new URL(window.location.href)
      url.searchParams.delete("welcome")
      window.history.replaceState({}, "", url.toString())
    }
  }, [])

  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("welcome") === "1"
    }
    return false
  })
  const cleanupRef = useRef<(() => void) | null>(null)
  const profile = getProfile()
  const stealthOn = profile.preferences.stealthMode
  const hasSaves = profile.savedStoryIds.length > 0

  useEffect(() => {
    let isMounted = true

    const params = new URLSearchParams(window.location.search)
    if (params.get("tab") === "membership") setActiveTab("membership")

    async function handleUser(u: AuthUser | null) {
      if (!isMounted) return
      setUser(u)
      setLoading(false)
      if (u) {
        // Profile is auto-created by the database trigger on auth.users INSERT.
        // Upsert as a safety fallback in case the trigger hasn't fired yet.
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", u.id)
          .maybeSingle()
        if (!existing && isMounted) {
          await supabase.from("profiles").upsert(
            {
              id: u.id,
              display_name: u.display_name || u.email?.split("@")[0] || "Reader",
            },
            { onConflict: "id" },
          )
        }
        const { data: profileData } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", u.id)
          .maybeSingle()
        if (profileData?.avatar_url && isMounted) setHeaderAvatarUrl(profileData.avatar_url)
        await loadPreferencesFromSupabase()
      } else {
        router.replace("/login")
      }
      if (isMounted) setProfileTick((t) => t + 1)
    }

    getCurrentUser().then((u) => {
      if (u) {
        handleUser(u)
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      if (session?.user) {
        handleUser(extractAuthUser(session.user))
      } else if (_event === "INITIAL_SESSION" && !session) {
        handleUser(null)
      } else if (_event === "SIGNED_OUT") {
        handleUser(null)
      }
    })

    return () => {
      isMounted = false
      authListener?.subscription?.unsubscribe()
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
    user?.display_name ||
    user?.email?.split("@")[0] ||
    t("account.guestReader")
  const initial = getInitial(displayName)

  return (
    <div className="container container-lg py-8 md:py-12">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <Avatar className="w-12 h-12 shrink-0 shadow-sm">
            <AvatarImage src={headerAvatarUrl} alt={displayName} />
            <AvatarFallback className="bg-[var(--accent)] text-[var(--accent-contrast)] text-[18px] font-bold">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold text-[var(--text-primary)]">{displayName}</h1>
            <p className="text-[13px] text-[var(--text-secondary)]">{user.email}</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} defaultValue="profile">
        {/* Mobile: horizontal tabs */}
        <div className="md:hidden mb-6 overflow-x-auto">
          <TabsList className="w-full justify-start">
            {tabIds.map((id) => {
              const Icon = tabIcons[id]
              return (
                <TabsTrigger key={id} value={id} className="gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t(`account.tabs.${id}`)}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        <div className="flex gap-8">
          {/* Desktop: sidebar */}
          <aside className="hidden md:block w-56 shrink-0">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 sticky top-24">
              <nav className="space-y-0.5" role="tablist" aria-label={t("account.accountSections")}>
                {tabIds.map((id) => {
                  const Icon = tabIcons[id]
                  return (
                    <TabsTrigger
                      key={id}
                      value={id}
                      className="w-full justify-start gap-2.5"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {t(`account.tabs.${id}`)}
                    </TabsTrigger>
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
            {showWelcome && (
              <div className="mb-6 p-4 rounded-2xl bg-[var(--red-subtle-bg)] border border-[var(--accent)] border-opacity-30 text-[13px] text-[var(--text-primary)] flex items-start justify-between gap-3 animate-banner-in">
                <div>
                  <p className="font-semibold mb-1">{t("account.welcomeTitle")}</p>
                  <p className="text-[var(--text-secondary)]">{t("account.welcomeMessage")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWelcome(false)}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] shrink-0 text-[18px] leading-none"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}

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

            <TabsContent value="profile">
              {user && <ProfileTab user={user} onAvatarChange={(url) => setHeaderAvatarUrl(url)} />}
            </TabsContent>
            <TabsContent value="personal">
              {user && <PersonalInfoTab user={user} />}
            </TabsContent>
            <TabsContent value="preferences">
              {user && <PreferencesTab user={user} />}
            </TabsContent>
            <TabsContent value="security">
              {user && <SecurityTab user={user} onSignOut={handleSignOut} />}
            </TabsContent>
            <TabsContent value="membership">
              <MembershipTab />
            </TabsContent>
            <TabsContent value="dashboard">
              <DashboardTab />
            </TabsContent>
            <TabsContent value="library">
              <LibraryTab />
            </TabsContent>
            <TabsContent value="settings">
              <SettingsTab user={user} onSignOut={handleSignOut} />
            </TabsContent>
          </main>
        </div>
      </Tabs>
    </div>
  )
}
