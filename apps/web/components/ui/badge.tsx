import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Design label chip: 22px height, 8px radius, outlined semantic colors.
const badgeVariants = cva(
  "inline-flex h-[22px] items-center justify-center gap-2 whitespace-nowrap rounded-[8px] border-2 bg-[#EDF0F0] px-3 py-0.5 text-[12px] font-bold leading-[14px]",
  {
    variants: {
      variant: {
        default: "border-[#7A37D8] text-[#7A37D8]",
        secondary: "border-[#727174] text-[#727174]",
        destructive: "border-[#FF3F56] text-[#FF3F56]",
        outline: "border-current bg-transparent text-foreground",
        success: "border-[#128240] text-[#128240]",
        warning: "border-[#C97E04] text-[#9A6103]",
        info: "border-[#1D4FC4] text-[#1D4FC4]",
        neutral: "border-[#727174] text-[#727174]",
      },
      pill: {
        true: "rounded-[8px] px-3",
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
