"use client"

import { useEffect, useState } from "react"
import { proxiedImageUrl, isValidImageUrl } from "@/lib/story-images"

type StoryImageProps = {
  imageUrl?: string | null
  pageUrl?: string | null
  alt: string
  className?: string
  priority?: boolean
  /** lead = hero; card = grid tile; story = story page; thumb = list */
  variant?: "lead" | "card" | "thumb" | "story"
}

function proxySize(variant: StoryImageProps["variant"]): { w: number; h: number } {
  switch (variant) {
    case "lead":
      return { w: 1200, h: 750 } // 16:10 hero
    case "card":
      return { w: 720, h: 450 } // 16:10 grid tile
    case "story":
      return { w: 1200, h: 600 } // 2:1 story page
    default:
      return { w: 320, h: 240 } // 4:3 list thumb
  }
}

export function StoryImage({
  imageUrl,
  pageUrl,
  alt,
  className = "",
  priority = false,
  variant = "thumb",
}: StoryImageProps) {
  const { w, h } = proxySize(variant)
  const [raw, setRaw] = useState<string | null>(isValidImageUrl(imageUrl) ? imageUrl : null)
  const [useDirect, setUseDirect] = useState(false)
  const [src, setSrc] = useState<string | null>(
    raw ? (useDirect ? raw : proxiedImageUrl(raw, w, h)) : null
  )
  const [failed, setFailed] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect -- sync raw/src/failed when imageUrl props change */
  useEffect(() => {
    if (isValidImageUrl(imageUrl)) {
      setRaw(imageUrl)
      setUseDirect(false)
      setSrc(proxiedImageUrl(imageUrl, w, h))
      setFailed(false)
      return
    }
    if (!pageUrl || !isValidImageUrl(pageUrl)) return

    let cancelled = false
    fetch(`/api/resolve-image?url=${encodeURIComponent(pageUrl)}`)
      .then((r) => r.json())
      .then((data: { imageUrl?: string | null }) => {
        if (cancelled) return
        if (isValidImageUrl(data.imageUrl)) {
          setRaw(data.imageUrl)
          setUseDirect(false)
          setSrc(proxiedImageUrl(data.imageUrl, w, h))
          setFailed(false)
        }
      })
      .catch(() => {
        /* leave placeholder */
      })

    return () => {
      cancelled = true
    }
  }, [imageUrl, pageUrl, w, h])
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleError() {
    if (!useDirect && raw) {
      setUseDirect(true)
      setSrc(raw)
      return
    }
    setFailed(true)
  }

  const frame =
    variant === "lead"
      ? "relative w-full aspect-[16/10] overflow-hidden bg-[var(--surface-alt)]"
      : variant === "card"
        ? "relative w-full aspect-[16/10] overflow-hidden bg-[var(--surface-alt)]"
        : variant === "story"
          ? "relative w-full aspect-[21/9] sm:aspect-[2/1] overflow-hidden bg-[var(--surface-alt)]"
          : "relative w-16 h-12 sm:w-[88px] sm:h-[66px] md:w-[112px] md:h-[84px] shrink-0 overflow-hidden bg-[var(--surface-alt)] rounded-[var(--radius-sm)]"

  if (failed || !src) {
    return (
      <div
        className={`${frame} ${className} flex items-center justify-center`}
        aria-hidden={variant === "thumb"}
        role={variant === "thumb" ? undefined : "img"}
        aria-label={variant === "thumb" ? undefined : alt}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--surface-alt)] to-[var(--surface)]" />
        {/* eslint-disable-next-line @next/next/no-img-element -- local logo placeholder */}
        <img
          src="/icon.svg"
          alt=""
          loading="lazy"
          decoding="async"
          className="relative h-8 w-8 object-contain opacity-70"
        />
      </div>
    )
  }

  return (
    <div className={`${frame} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary news domains via weserv proxy */}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        onError={handleError}
      />
    </div>
  )
}
