import * as React from "react"
import { cn } from "@/lib/utils"

function Avatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  )
}

function AvatarImage({ className, src, alt, ...props }: React.ComponentProps<"img">) {
  if (!src) return null
  return (
    <img
      src={src}
      alt={alt}
      className={cn("aspect-square h-full w-full object-cover", className)}
      {...props}
    />
  )
}

function AvatarFallback({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] font-bold",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Avatar, AvatarImage, AvatarFallback }
