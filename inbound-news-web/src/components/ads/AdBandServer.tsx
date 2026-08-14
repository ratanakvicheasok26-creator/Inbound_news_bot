import { shouldShowAds } from "@/lib/ads"
import { pickSponsorFrom, type AdPlacement } from "@/lib/sponsors"
import { getActiveSponsors } from "@/lib/sponsors-server"
import { AdBand } from "@/components/ads/AdBand"

type Props = {
  placement: AdPlacement
  className?: string
  flush?: boolean
}

/** Server wrapper — picks today’s creative from Supabase (or mock fallback). */
export async function AdBandServer({ placement, className, flush }: Props) {
  if (!shouldShowAds()) return null

  const { sponsors } = await getActiveSponsors()
  const creative = pickSponsorFrom(placement, sponsors)
  if (!creative) return null

  return (
    <AdBand
      placement={placement}
      creative={creative}
      sponsors={sponsors}
      className={className}
      flush={flush}
    />
  )
}
