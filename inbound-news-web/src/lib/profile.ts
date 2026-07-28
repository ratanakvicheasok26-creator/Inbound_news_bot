import { supabase } from "./auth"

const STORAGE_KEY = "ib_profile"

export interface ReadEntry {
  id: string
  title: string
  category: string
  readAt: string
}

export interface UserProfile {
  literacyScore: number
  readingStreak: { current: number; lastDate: string }
  recentlyRead: ReadEntry[]
  savedStoryIds: string[]
  followedConcepts: string[]
  preferences: {
    defaultTier: "eli5" | "standard" | "deep"
    defaultLang: "en" | "km"
    stealthMode: boolean
    telegramDigest: boolean
  }
}

const DEFAULTS: UserProfile = {
  literacyScore: 0,
  readingStreak: { current: 0, lastDate: "" },
  recentlyRead: [],
  savedStoryIds: [],
  followedConcepts: [],
  preferences: {
    defaultTier: "standard",
    defaultLang: "en",
    stealthMode: false,
    telegramDigest: false,
  },
}

export function getProfile(): UserProfile {
  if (typeof window === "undefined") return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveProfile(partial: Partial<UserProfile>): void {
  if (typeof window === "undefined") return
  const current = getProfile()
  const next = { ...current, ...partial }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function addPoints(pts: number): void {
  if (typeof window === "undefined") return
  const profile = getProfile()
  if (profile.preferences.stealthMode) return
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  let streak = profile.readingStreak.current
  if (profile.readingStreak.lastDate === today) {
    // same day, streak unchanged
  } else if (profile.readingStreak.lastDate === yesterday) {
    streak += 1
  } else {
    streak = 1
  }
  saveProfile({
    literacyScore: profile.literacyScore + pts,
    readingStreak: { current: streak, lastDate: today },
  })
}

export function trackStoryRead(story: { id: string; title: string; category: string }): void {
  if (typeof window === "undefined") return
  const profile = getProfile()
  if (profile.preferences.stealthMode) return
  const entry: ReadEntry = { ...story, readAt: new Date().toISOString() }
  const existing = profile.recentlyRead.filter((r) => r.id !== story.id)
  const recentlyRead = [entry, ...existing].slice(0, 20)
  saveProfile({ recentlyRead })
  addPoints(5)
}

export function recordJargonTap(): void {
  addPoints(10)
}

export function recordTierSwitch(): void {
  addPoints(15)
}

export function recordSourceComparison(): void {
  addPoints(20)
}

export function toggleSavedStory(id: string): boolean {
  const profile = getProfile()
  const saved = profile.savedStoryIds.includes(id)
  const next = saved
    ? profile.savedStoryIds.filter((s) => s !== id)
    : [...profile.savedStoryIds, id]
  saveProfile({ savedStoryIds: next })
  return !saved
}

export function isStorySaved(id: string): boolean {
  return getProfile().savedStoryIds.includes(id)
}

export function toggleFollowedConcept(slug: string): boolean {
  const profile = getProfile()
  const followed = profile.followedConcepts.includes(slug)
  const next = followed
    ? profile.followedConcepts.filter((c) => c !== slug)
    : [...profile.followedConcepts, slug]
  saveProfile({ followedConcepts: next })
  return !followed
}

export function isConceptFollowed(slug: string): boolean {
  return getProfile().followedConcepts.includes(slug)
}

export function updatePreferences(prefs: Partial<UserProfile["preferences"]>): void {
  const profile = getProfile()
  saveProfile({ preferences: { ...profile.preferences, ...prefs } })
}

export function resetProfile(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}

// --- Supabase sync for logged-in users ---

export async function syncPreferencesToSupabase(): Promise<void> {
  if (typeof window === "undefined") return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const profile = getProfile()
  await supabase.from("profiles").upsert({
    id: user.id,
    default_tier: profile.preferences.defaultTier,
    default_lang: profile.preferences.defaultLang,
    stealth_mode: profile.preferences.stealthMode,
    telegram_digest: profile.preferences.telegramDigest,
  }, { onConflict: "id" })
}

export async function loadPreferencesFromSupabase(): Promise<void> {
  if (typeof window === "undefined") return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  if (!data) return
  saveProfile({
    preferences: {
      defaultTier: data.default_tier || "standard",
      defaultLang: data.default_lang || "en",
      stealthMode: data.stealth_mode ?? false,
      telegramDigest: data.telegram_digest ?? false,
    },
  })
}

export async function getDisplayName(): Promise<string> {
  if (typeof window === "undefined") return "Reader"
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return "Guest Reader"
  const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).single()
  return data?.display_name || user.email?.split("@")[0] || "Reader"
}
