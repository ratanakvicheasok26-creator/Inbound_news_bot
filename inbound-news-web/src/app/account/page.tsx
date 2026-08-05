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
      <div className="container py-16 text-center text-[var(--text-secondary)]">
        Loading…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container container-xs py-16 text-center">
        <h1 className="page-title mb-3">Account</h1>
        <p className="text-[15px] text-[var(--text-secondary)] mb-8">
          Sign in so reading preferences can sync. Library, score, and saves stay on this device.
        </p>
        <Link href="/auth" className="btn-primary">
          Sign in / Sign up
        </Link>
        <div className="mt-6">
          <Link href="/" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)]">
            ← Continue as guest
          </Link>
        </div>
      </div>
    )
  }

  const displayName = user.email?.split("@")[0] || "Reader"

  return (
    <div className="container container-lg py-10 md:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title mb-2">Account</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold">{displayName}</span>
            <span className="text-[13px] text-[var(--text-secondary)]">{user.email}</span>
            {stealthOn && (
              <span className="meta-text text-[var(--accent)] bg-[var(--red-subtle-bg)] px-2 py-0.5 rounded-full">
                Stealth
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="meta-text bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-full">
            {profile.literacyScore} pts
          </span>
          <button type="button" onClick={handleSignOut} className="btn-ghost">
            Sign out
          </button>
        </div>
      </div>

      <div className="tier-toggle tier-toggle--full mb-8 max-w-md">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 ${activeTab === tab.id ? "active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "library" && <LibraryTab />}
      {activeTab === "settings" && <SettingsTab user={user} onSignOut={handleSignOut} />}
    </div>
  )
}
