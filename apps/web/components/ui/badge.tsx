import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Design label chip: 22px height, 8px radius, outlined semantic colors.
const badgeVariants = cva(
  "inline-flex h-[22px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--ex-radius-label)] border px-2.5 py-0.5 text-[12px] font-semibold leading-[14px]",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-primary",
        secondary: "border-border bg-muted text-muted-foreground",
        destructive: "border-danger-100 bg-danger-50 text-danger-700",
        outline: "border-border bg-transparent text-foreground",
        success: "border-success-100 bg-success-50 text-success-700",
        warning: "border-warning-100 bg-warning-50 text-warning-700",
        info: "border-info-100 bg-info-50 text-info-700",
        neutral: "border-border bg-muted text-neutral-700",
      },
      pill: {
        true: "rounded-[var(--ex-radius-pill)] px-3",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      pill: false,
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, pill, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, pill }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
