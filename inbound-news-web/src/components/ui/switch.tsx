"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  className?: string
  disabled?: boolean
}

function Switch({ checked = false, onCheckedChange, className, disabled }: SwitchProps) {
  return (
    <button
      role="switch"
      type="button"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-[var(--border)] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "bg-[var(--accent)] border-[var(--accent)]"
          : "bg-[var(--surface-alt)]",
        className,
      )}
    >
      <span
        data-state={checked ? "checked" : "unchecked"}
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full shadow-lg ring-0 transition-transform",
          checked
            ? "translate-x-5 bg-[var(--accent-contrast)]"
            : "translate-x-0.5 bg-[var(--text-secondary)]",
        )}
      />
    </button>
  )
}

export { Switch }
