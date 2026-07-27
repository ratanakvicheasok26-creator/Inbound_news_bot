"use client"

import { useState } from "react"

interface ReadingTierToggleProps {
  onChange: (tier: "eli5" | "standard" | "deep") => void
  active: string
}

export function ReadingTierToggle({ onChange, active }: ReadingTierToggleProps) {
  const tiers = [
    { id: "eli5" as const, label: "ELI5", color: "var(--green-substance)" },
    { id: "standard" as const, label: "Standard", color: "var(--hype)" },
    { id: "deep" as const, label: "Deep", color: "var(--red-alert)" },
  ]

  return (
    <div className="flex gap-0 border border-[var(--border)] overflow-hidden">
      {tiers.map((tier) => (
        <button
          key={tier.id}
          onClick={() => onChange(tier.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
            active === tier.id
              ? "text-[var(--accent-contrast)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          style={active === tier.id ? { backgroundColor: tier.color } : {}}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tier.color }} />
          {tier.label}
        </button>
      ))}
    </div>
  )
}
