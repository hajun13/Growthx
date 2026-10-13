import * as React from "react"

import { cn } from "@/lib/utils"

const Kbd = React.forwardRef<HTMLElement, React.ComponentProps<"kbd">>(
  ({ className, ...props }, ref) => (
    <kbd
      ref={ref}
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none",
        "[&_svg:not([class*='size-'])]:size-3",
        "[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background",
        className
      )}
      {...props}
    />
  )
)
Kbd.displayName = "Kbd"

const KbdGroup = React.forwardRef<HTMLElement, React.ComponentProps<"kbd">>(
  ({ className, ...props }, ref) => (
    <kbd
      ref={ref}
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  )
)
KbdGroup.displayName = "KbdGroup"

export { Kbd, KbdGroup }
