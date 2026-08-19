"use client"

import { useState, useEffect, useRef } from "react"
import { Check, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { User } from "@supabase/supabase-js"

interface PersonalInfoTabProps {
  user: User
}

export function PersonalInfoTab({ user }: PersonalInfoTabProps) {
  const { t } = useI18n()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("first_name, last_name, phone, address")
          .eq("id", user.id)
          .maybeSingle()
        if (!mounted || !data) return
        if (data.first_name) setFirstName(data.first_name)
        if (data.last_name) setLastName(data.last_name)
        if (data.phone) setPhone(data.phone)
        if (data.address) setAddress(data.address)
      } catch {
        // Column may not exist yet — form still renders with defaults
      }
    }
    load()
    return () => { mounted = false }
  }, [user.id])

  useEffect(() => {
    return () => { if (savedTimer.current) clearTimeout(savedTimer.current) }
  }, [])

  function flashSaved() {
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 3000)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaved(false)
    setSaving(true)
    try {
      const { error: saveError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
        }, { onConflict: "id" })
      if (saveError) {
        setError(saveError.message)
        setSaving(false)
        return
      }
      flashSaved()
    } catch {
      setError("Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="max-w-[580px] space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("account.personalInfo.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t("account.personalInfo.firstName")}</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t("account.personalInfo.firstNamePlaceholder")}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t("account.personalInfo.lastName")}</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t("account.personalInfo.lastNamePlaceholder")}
                maxLength={50}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("account.personalInfo.emailReadonly")}</Label>
            <div className="flex items-center h-11 px-4 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl text-[15px] text-[var(--text-secondary)]">
              {user.email}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t("account.personalInfo.phone")}</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("account.personalInfo.phonePlaceholder")}
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t("account.personalInfo.address")}</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("account.personalInfo.addressPlaceholder")}
              maxLength={200}
            />
          </div>
        </CardContent>
      </Card>

      {(error || saved) && (
        <div className="space-y-2">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--red-subtle-bg)] text-[13px] text-[var(--accent)]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-[13px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              <Check className="w-4 h-4 shrink-0" />
              {t("account.profile.saved")}
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="h-11 px-6 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-[14px] font-semibold hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {saving ? t("account.profile.saving") : t("account.profile.saveChanges")}
      </button>
    </form>
  )
}
