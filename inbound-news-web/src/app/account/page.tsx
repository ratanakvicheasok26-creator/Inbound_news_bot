"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase, signOut } from "@/lib/auth"
import { getProfile, loadPreferencesFromSupabase } from "@/lib/profile"
import { DashboardTab } from "@/components/account/DashboardTab"
import { LibraryTab } from "@/components/account/LibraryTab"
import { SettingsTab } from "@/components/account/SettingsTab"
import type { User } from "@supabase/supabase-js"

const tabs = [
  { id: "dashboard" as const, label: "Dashboard" },
  { id: "library" as const, label: "Library" },
  { id: "settings" as const, label: "Settings" },
]

export default function AccountPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"dashboard" | "library" | "settings">("dashboard")
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const profile = getProfile()
  const stealthOn = profile.preferences.stealthMode

  useEffect(() => {
    let mounted = true
    async function check() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!mounted) return
      setUser(u)
      setLoading(false)
      if (u) await loadPreferencesFromSupabase()
    }
    check()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadPreferencesFromSupabase()
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  async function handleSignOut() {
    await signOut()
    setUser(null)
    router.push("/")
  }

  if (loading) {
    return (
      <div className="container">
        <section className="py-16 md:py-24 max-w-[960px] mx-auto text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">Loading...</p>
        </section>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container">
        <section className="py-16 md:py-24 max-w-[480px] mx-auto text-center">
          <div className="pb-8 border-b-2 border-[var(--text-primary)]">
            <h1 className="page-title">
              MY DASHBOARD
            </h1>
          </div>
          <div className="mt-3 mb-8 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
            Sign in to track your literacy progress across sessions and devices.
          </div>
          <Link
            href="/auth"
            className="inline-block px-8 py-3 bg-[var(--text-primary)] text-inverted font-mono text-[12px] font-bold uppercase tracking-[0.06em] hover:bg-[var(--accent)] transition-colors"
          >
            Sign In / Sign Up
          </Link>
          <div className="mt-6">
            <Link
              href="/"
              className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
            >
              &larr; Continue as guest
            </Link>
          </div>
        </section>
      </div>
    )
  }

  const displayName = user.email?.split("@")[0] || "Reader"

  return (
    <div className="container">
      <section className="py-12 md:py-16 max-w-[960px] mx-auto">
        {/* Header */}
        <div className="pb-10 border-b-2 border-[var(--text-primary)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="page-title">
              MY DASHBOARD
            </h1>
            <div className="flex items-center gap-3 flex-shrink-0 mt-2">
              {stealthOn && (
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] font-bold text-[var(--accent)] border-2 border-[var(--accent)] px-2 py-1">
                  Stealth Active
                </span>
              )}
              <button
                onClick={handleSignOut}
                className="font-mono text-[10px] uppercase tracking-[0.06em] font-bold text-[var(--text-secondary)] border-2 border-[var(--border)] px-3 py-1 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] font-bold text-[var(--text-secondary)] border-2 border-[var(--text-primary)] px-3 py-1">
              {displayName}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-secondary)] border-2 border-[var(--border)] px-3 py-1">
              {user.email}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] font-bold border-2 border-[var(--text-primary)] px-3 py-1">
              {profile.literacyScore} PTS
            </span>
          </div>
        </div>

        {/* Tab Bar — 3-segment segmented control */}
        <div className="flex border-2 border-[var(--text-primary)] overflow-hidden mt-8 mb-10 max-w-[480px]">
          {tabs.map((tab, i) => (
            <div key={tab.id} className="flex">
              {i > 0 && <div className="w-px bg-[var(--border)]" />}
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] transition-colors ${
                  activeTab === tab.id
                    ? "bg-[var(--text-primary)] text-inverted"
                    : "text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-inverted"
                }`}
              >
                {tab.label}
              </button>
            </div>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "library" && <LibraryTab />}
        {activeTab === "settings" && <SettingsTab user={user} onSignOut={handleSignOut} />}
      </section>
    </div>
  )
}
