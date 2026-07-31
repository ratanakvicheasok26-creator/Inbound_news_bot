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

function proxyWidth(variant: StoryImageProps["variant"]): number {
  if (variant === "lead" || variant === "story") return 1200
  if (variant === "card") return 720
  return 320
}

export function StoryImage({
  imageUrl,
  pageUrl,
  alt,
  className = "",
  priority = false,
  variant = "thumb",
}: StoryImageProps) {
  const [src, setSrc] = useState<string | null>(
    isValidImageUrl(imageUrl) ? proxiedImageUrl(imageUrl, proxyWidth(variant)) : null
  )
  const [failed, setFailed] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect -- sync src/failed when imageUrl props change */
  useEffect(() => {
    if (isValidImageUrl(imageUrl)) {
      setSrc(proxiedImageUrl(imageUrl, proxyWidth(variant)))
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
          setSrc(proxiedImageUrl(data.imageUrl, proxyWidth(variant)))
          setFailed(false)
        }
      })
      .catch(() => {
        /* leave placeholder */
      })

    return () => {
      cancelled = true
    }
  }, [imageUrl, pageUrl, variant])
  /* eslint-enable react-hooks/set-state-in-effect */

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
        className={`${frame} ${className}`}
        aria-hidden={variant === "thumb"}
        role={variant === "thumb" ? undefined : "img"}
        aria-label={variant === "thumb" ? undefined : alt}
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--text-primary) 1px, transparent 1px), linear-gradient(45deg, var(--text-primary) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
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
        onError={() => setFailed(true)}
      />
    </div>
  )
}
