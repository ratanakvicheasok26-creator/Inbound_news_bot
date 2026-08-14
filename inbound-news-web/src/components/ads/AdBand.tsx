"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import {
  MOCK_SPONSORS,
  pickSponsor,
  uniqueSponsorsForPlacement,
  type AdPlacement,
  type SponsorCreative,
} from "@/lib/sponsors"
import { shouldShowAds } from "@/lib/ads"

const ROTATE_MS = 30_000

type AdBandProps = {
  placement: AdPlacement
  className?: string
  /** Skip outer container when already inside one (e.g. story / home feed). */
  flush?: boolean
  /** Server-picked first creative (stable hydration). */
  creative?: SponsorCreative
  /** Roster to rotate through every 30s. */
  sponsors?: SponsorCreative[]
}

function isHttpHref(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

function SponsorPoster({ creative }: { creative: SponsorCreative }) {
  const liveLink = isHttpHref(creative.href)
  const className =
    "ad-band-card group grid grid-cols-1 md:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] no-underline text-inherit touch-manipulation"

  const inner = (
    <>
      <div className="ad-band-media relative aspect-[16/10] md:aspect-auto md:min-h-[168px] lg:min-h-[188px] overflow-hidden bg-[var(--surface)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- sponsor CDN / Storage URLs */}
        <img
          src={creative.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-3 px-4 py-4 sm:px-5 md:px-6 md:py-5">
        <div className="min-w-0">
          <p className="font-display-modern text-[16px] sm:text-[17px] md:text-[18px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] leading-tight">
            {creative.brand}
          </p>
          <p className="mt-1.5 text-[13px] sm:text-[14px] leading-snug text-[var(--text-secondary)] max-w-[46ch] line-clamp-3">
            {creative.line}
          </p>
        </div>
        <span className="inline-flex w-fit min-h-11 items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[13px] font-semibold text-[var(--text-primary)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]">
          {creative.cta}
        </span>
      </div>
    </>
  )

  if (liveLink) {
    return (
      <a
        href={creative.href}
        className={className}
        aria-label={`Sponsored: ${creative.brand}`}
        target="_blank"
        rel="noopener noreferrer sponsored"
      >
        {inner}
      </a>
    )
  }

  return (
    <div className={className} aria-label={`Sponsored: ${creative.brand}`}>
      {inner}
    </div>
  )
}

/**
 * Poster-style sponsor band — stacked on phones, side-by-side from tablet up.
 * Rotates creatives every 30 seconds when more than one sponsor is available.
 */
export function AdBand({
  placement,
  className,
  flush = false,
  creative,
  sponsors,
}: AdBandProps) {
  const pool = useMemo(
    () => uniqueSponsorsForPlacement(placement, sponsors?.length ? sponsors : MOCK_SPONSORS),
    [placement, sponsors]
  )

  const startIndex = useMemo(() => {
    if (creative) {
      const i = pool.findIndex((s) => s.id === creative.id)
      if (i >= 0) return i
    }
    return 0
  }, [pool, creative])

  const [index, setIndex] = useState(startIndex)

  const [prevStartIndex, setPrevStartIndex] = useState(startIndex)
  if (prevStartIndex !== startIndex) {
    setPrevStartIndex(startIndex)
    setIndex(startIndex)
  }

  useEffect(() => {
    if (pool.length < 2) return

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      setIndex((i) => (i + 1) % pool.length)
    }
    const id = window.setInterval(tick, ROTATE_MS)
    return () => window.clearInterval(id)
  }, [pool.length])

  if (!shouldShowAds()) return null

  const picked = pool[index] ?? creative ?? pickSponsor(placement)

  return (
    <aside
      className={cn(
        "ad-band min-w-0",
        flush ? "py-5 sm:py-6 md:py-8" : "border-y border-[var(--border)] bg-[var(--bg)]",
        className
      )}
      aria-label="Sponsored"
      data-ad-placement={placement}
      data-sponsor-id={picked.id}
    >
      <div className={cn(!flush && "container py-5 sm:py-6 md:py-8")}>
        <p className="meta-text mb-2 text-center text-[var(--text-secondary)]">Sponsored</p>
        <div className="ad-band-frame overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-alt)]">
          <SponsorPoster creative={picked} />
        </div>
      </div>
    </aside>
  )
}
