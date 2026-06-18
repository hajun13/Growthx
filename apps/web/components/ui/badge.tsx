import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Design V2: 상태 라벨은 2px에 가까운 각진 형태, 필터/해시태그성 칩만 pill.
// variant: primary(퍼플soft) | success | warning | danger | info | neutral
// appearance: soft(default) | solid | outline
const badgeVariants = cva(
  "inline-flex items-center gap-1 h-[22px] px-2 text-[11px] font-semibold leading-none whitespace-nowrap rounded-[var(--ex-radius-label)] tracking-wide",
  {
    variants: {
      variant: {
        // soft tones (default appearance)
        default:   "bg-purple-50 text-purple-700",
        secondary: "bg-neutral-100 text-neutral-700",
        destructive: "bg-[#FDECEC] text-[#C8353A]",
        outline: "text-foreground border border-current bg-transparent",
        // 도메인 시맨틱 (status 토큰)
        success: "bg-[#E9F8EF] text-[#0E6633]",
        warning: "bg-[#FEF5E7] text-[#9A6103]",
        info:    "bg-[#EAF1FE] text-[#1D4FC4]",
        neutral: "bg-neutral-100 text-neutral-700",
      },
      pill: {
        true: "rounded-pill px-2.5",
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
