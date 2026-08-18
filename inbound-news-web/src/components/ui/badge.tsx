import * as React from "react"
import { cn } from "@/lib/utils"

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & {
  variant?: "default" | "secondary" | "destructive" | "outline"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
        {
          "bg-[var(--accent)] text-[var(--accent-contrast)]": variant === "default",
          "bg-[var(--surface-alt)] text-[var(--text-secondary)]": variant === "secondary",
          "bg-[var(--red-subtle-bg)] text-[var(--accent)]": variant === "destructive",
          "border border-[var(--border)] text-[var(--text-secondary)]": variant === "outline",
        },
        className,
      )}
      {...props}
    />
  )
}

export { Badge }
