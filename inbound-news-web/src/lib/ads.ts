/** Ad placement helpers — mocks + Supabase-backed sponsors. */

export type { AdPlacement } from "@/lib/sponsors"
export { pickSponsor, pickSponsorFrom } from "@/lib/sponsors"

/** Hide all ad bands when NEXT_PUBLIC_ADS_MOCK=0. */
export function shouldShowAds(): boolean {
  if (process.env.NEXT_PUBLIC_ADS_MOCK === "0") return false
  return true
}
