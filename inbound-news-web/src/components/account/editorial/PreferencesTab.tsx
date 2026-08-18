"use client"

import { useState, useEffect } from "react"
import { Sun, Moon, Monitor } from "lucide-react"
import { supabase } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { User } from "@supabase/supabase-js"

interface PreferencesTabProps {
  user: User
}

const TOPIC_OPTIONS = [
  "AI & ML", "Cybersecurity", "Startups", "DeFi & Crypto",
  "Big Tech", "Hardware", "Science", "Regulation",
  "Cloud & DevOps", "Open Source", "Gaming", "Climate Tech",
  "Telecom", "Mobile", "Southeast Asia",
]

export function PreferencesTab({ user }: PreferencesTabProps) {
  const { t } = useI18n()
  const [dailyBriefing, setDailyBriefing] = useState(false)
  const [breakingAlerts, setBreakingAlerts] = useState(false)
  const [topicInterests, setTopicInterests] = useState<string[]>([])
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("newsletter_daily, newsletter_breaking, topic_interests, theme")
        .eq("id", user.id)
        .maybeSingle()
      if (!mounted || !data) return
      setDailyBriefing(data.newsletter_daily ?? false)
      setBreakingAlerts(data.newsletter_breaking ?? false)
      setTopicInterests(data.topic_interests ?? [])
      if (data.theme === "light" || data.theme === "dark" || data.theme === "system") {
        setTheme(data.theme)
      }
    }
    load()
    return () => { mounted = false }
  }, [user.id])

  async function persist(partial: Record<string, unknown>) {
    setSaving(true)
    try {
      await supabase
        .from("profiles")
        .upsert({ id: user.id, ...partial }, { onConflict: "id" })
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  function toggleDailyBriefing() {
    const next = !dailyBriefing
    setDailyBriefing(next)
    persist({ newsletter_daily: next })
  }

  function toggleBreakingAlerts() {
    const next = !breakingAlerts
    setBreakingAlerts(next)
    persist({ newsletter_breaking: next })
  }

  function toggleTopic(topic: string) {
    const next = topicInterests.includes(topic)
      ? topicInterests.filter((t) => t !== topic)
      : [...topicInterests, topic]
    setTopicInterests(next)
    persist({ topic_interests: next })
  }

  function applyTheme(next: "light" | "dark" | "system") {
    setTheme(next)
    persist({ theme: next })
    // Apply immediately
    if (next === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light")
    } else {
      document.documentElement.setAttribute("data-theme", next)
    }
    try {
      localStorage.setItem("theme", next === "system"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : next)
      document.cookie = `theme=${next === "system" ? "system" : next}; path=/; max-age=31536000; SameSite=Lax`
    } catch {}
  }

  const themes = [
    { id: "light" as const, label: t("account.preferences.themeLight"), Icon: Sun },
    { id: "dark" as const, label: t("account.preferences.themeDark"), Icon: Moon },
    { id: "system" as const, label: t("account.preferences.themeSystem"), Icon: Monitor },
  ]

  return (
    <div className="max-w-[580px] space-y-6">
      {/* Newsletters */}
      <Card>
        <CardHeader>
          <CardTitle>{t("account.preferences.newsletters")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-[var(--text-primary)]">{t("account.preferences.dailyBriefing")}</p>
              <p className="text-[13px] text-[var(--text-secondary)]">{t("account.preferences.dailyBriefingHint")}</p>
            </div>
            <Switch checked={dailyBriefing} onCheckedChange={toggleDailyBriefing} />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-[var(--text-primary)]">{t("account.preferences.breakingAlerts")}</p>
              <p className="text-[13px] text-[var(--text-secondary)]">{t("account.preferences.breakingAlertsHint")}</p>
            </div>
            <Switch checked={breakingAlerts} onCheckedChange={toggleBreakingAlerts} />
          </div>
        </CardContent>
      </Card>

      {/* Topic Interests */}
      <Card>
        <CardHeader>
          <CardTitle>{t("account.preferences.topics")}</CardTitle>
          <CardDescription>{t("account.preferences.topicsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TOPIC_OPTIONS.map((topic) => {
              const active = topicInterests.includes(topic)
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  className={`inline-flex items-center h-8 px-3 rounded-full text-[12px] font-medium border transition-all ${
                    active
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]"
                      : "bg-[var(--bg)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {active && <Badge className="mr-1.5 h-4 w-4 p-0 flex items-center justify-center">✓</Badge>}
                  {topic}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle>{t("account.preferences.theme")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {themes.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => applyTheme(opt.id)}
                className={`flex flex-col items-center gap-2 h-24 rounded-xl border-2 text-[13px] font-medium transition-all ${
                  theme === opt.id
                    ? "border-[var(--accent)] bg-[var(--red-subtle-bg)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <opt.Icon className="h-5 w-5" />
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {saving && (
        <p className="text-[12px] text-[var(--text-secondary)] text-center">Saving…</p>
      )}
    </div>
  )
}
