"use client"

interface ReadingTierToggleProps {
  onChange: (tier: "eli5" | "standard" | "deep") => void
  active: "eli5" | "standard" | "deep"
}

export function ReadingTierToggle({ onChange, active }: ReadingTierToggleProps) {
  const tiers = [
    { id: "eli5" as const, label: "ELI5" },
    { id: "standard" as const, label: "Standard" },
    { id: "deep" as const, label: "Deep" },
  ]

  return (
    <div className="tier-toggle">
      {tiers.map((tier) => (
        <button
          key={tier.id}
          type="button"
          onClick={() => onChange(tier.id)}
          className={active === tier.id ? "active" : ""}
        >
          {tier.label}
        </button>
      ))}
    </div>
  )
}
