"use client"

import { useI18n } from "@/lib/i18n/LocaleProvider"

/**
 * Hydration-safe inline translation for text rendered by server components.
 * The server and the first client render both use the default locale (English),
 * so there is no mismatch; the text swaps to Khmer once mounted. If the key is
 * unknown in both dictionaries, the raw key is rendered — pass `fallback` to
 * control what shows instead.
 */
export function LocalizedText({ k, fallback }: { k: string; fallback?: string }) {
  const { t } = useI18n()
  const text = t(k)
  return <>{text === k ? (fallback ?? text) : text}</>
}
