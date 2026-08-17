"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import type { GlossaryTerm } from "@/lib/types"
import { glossaryCopy } from "@/lib/glossary"
import { useI18n } from "@/lib/i18n/LocaleProvider"

interface JargonPopoverProps {
  term: GlossaryTerm
  position: { x: number; y: number }
  onClose: () => void
}

export function JargonPopover({ term, position, onClose }: JargonPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { locale, t } = useI18n()
  const copy = glossaryCopy(term, locale)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  const viewW = typeof window !== "undefined" ? window.innerWidth : 1200
  const popoverWidth = Math.min(320, Math.max(0, viewW - 16))
  const left = Math.max(8, Math.min(position.x, viewW - popoverWidth - 8))
  const top = position.y + 8

  return (
    <div
      ref={ref}
      className="fixed z-[200] min-w-0 bg-[var(--surface)] border-2 border-[var(--text-primary)]"
      style={{ left, top, width: popoverWidth }}
    >
      <div className="px-4 pt-4 pb-3 border-b-2 border-[var(--text-primary)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[18px] font-extrabold text-[var(--text-primary)] leading-tight tracking-tight">
              {copy.heading}
            </h3>
            {copy.nativeName ? (
              <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-snug">
                {copy.nativeName}
              </p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[18px] leading-none mt-0.5 p-0.5"
            aria-label={t("common.close")}
          >
            &times;
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="text-[13px] text-[var(--text-primary)] leading-relaxed mb-3">
          {copy.definition}
        </p>
        <div className="p-3 bg-[var(--surface-alt)] border-l-2 border-[var(--accent)]">
          <p className="text-[12px] text-[var(--text-secondary)] italic leading-relaxed">
            &ldquo;{copy.analogy}&rdquo;
          </p>
        </div>
      </div>

      <div className="px-4 pb-3 border-t border-[var(--border)] pt-3">
        <Link
          href={`/glossary#${term.slug}`}
          onClick={onClose}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[var(--accent)] font-bold hover:text-[var(--red-hover)] transition-colors"
        >
          {t("glossary.viewInGlossary")} &rarr;
        </Link>
      </div>
    </div>
  )
}
