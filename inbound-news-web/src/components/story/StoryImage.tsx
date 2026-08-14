"use client"

import { useEffect, useState } from "react"
import { displayImageUrl, isValidImageUrl, shouldLoadImageDirect } from "@/lib/story-images"
import { resolveImageCached } from "@/lib/client-fetch"

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
      return { w: 1200, h: 750 }
    case "card":
      return { w: 720, h: 450 }
    case "story":
      return { w: 1200, h: 600 }
    default:
      return { w: 320, h: 240 }
  }
}

function srcFor(url: string, w: number, h: number): string {
  return displayImageUrl(url, w, h)
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
  const given = isValidImageUrl(imageUrl) ? imageUrl : null
  const [resolved, setResolved] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [usedDirectFallback, setUsedDirectFallback] = useState(false)

  const raw = given || resolved
  const src = raw ? srcFor(raw, w, h) : null

  useEffect(() => {
    if (given) return
    if (!pageUrl || !isValidImageUrl(pageUrl)) return

    const controller = new AbortController()
    resolveImageCached(pageUrl, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return
        if (isValidImageUrl(next)) {
          setResolved(next)
          setFailed(false)
        }
      })
      .catch(() => {
        /* leave placeholder */
      })

    return () => {
      controller.abort()
    }
  }, [given, pageUrl])

  function handleError() {
    if (!raw) {
      setFailed(true)
      return
    }
    // Proxied URL failed — try the original once, without swapping back and forth.
    if (!usedDirectFallback && !shouldLoadImageDirect(raw)) {
      setUsedDirectFallback(true)
      return
    }
    setFailed(true)
  }

  const displaySrc =
    usedDirectFallback && raw ? raw : src

  const frame =
    variant === "lead"
      ? "relative w-full aspect-[16/10] overflow-hidden bg-[var(--surface-alt)]"
      : variant === "card"
        ? "relative w-full aspect-[16/10] overflow-hidden bg-[var(--surface-alt)]"
        : variant === "story"
          ? "relative w-full aspect-[21/9] sm:aspect-[2/1] overflow-hidden bg-[var(--surface-alt)]"
          : "relative w-16 h-12 sm:w-[88px] sm:h-[66px] md:w-[112px] md:h-[84px] shrink-0 overflow-hidden bg-[var(--surface-alt)] rounded-[var(--radius-sm)]"

  if (failed || !displaySrc) {
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
        src={displaySrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        onError={handleError}
      />
    </div>
  )
}
