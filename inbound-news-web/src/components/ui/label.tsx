"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "text-[13px] font-medium text-[var(--text-secondary)] leading-none",
        className,
      )}
      {...props}
    />
  )
}

export { Label }
