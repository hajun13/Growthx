import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// DESIGN.md §2/§7 — 라벨 칩: 높이 22px, 라벨 radius(rounded-sm=6px), shape="pill" 이면 완전 라운드.
// variant 군: 시맨틱(default~neutral) / 평가·KPI 상태 7종 / 등급 Solid·Soft S~D.
const badgeVariants = cva(
  "inline-flex h-[22px] items-center justify-center gap-1.5 whitespace-nowrap border px-2.5 py-0.5 text-xs font-semibold leading-[14px]",
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
        // 테두리 없는 muted 칩 — 미집계 등급("—") 등
        muted: "border-transparent bg-muted text-muted-foreground",
        // 상태 7종 (DESIGN §2)
        "status-not-started":
          "border-transparent bg-status-not-started-bg text-status-not-started-fg",
        "status-in-progress":
          "border-transparent bg-status-in-progress-bg text-status-in-progress-fg",
        "status-submitted":
          "border-transparent bg-status-submitted-bg text-status-submitted-fg",
        "status-review":
          "border-transparent bg-status-review-bg text-status-review-fg",
        "status-revision":
          "border-transparent bg-status-revision-bg text-status-revision-fg",
        "status-finalized":
          "border-transparent bg-status-finalized-bg text-status-finalized-fg",
        "status-danger":
          "border-transparent bg-status-danger-bg text-status-danger-fg",
        // 등급 Solid — 글씨는 gradeFg 토큰(C 만 진갈색, 구 gradeSolidClass 와 동일)
        "grade-s": "border-transparent bg-grade-s text-gradeFg-s",
        "grade-a": "border-transparent bg-grade-a text-gradeFg-a",
        "grade-b": "border-transparent bg-grade-b text-gradeFg-b",
        "grade-c": "border-transparent bg-grade-c text-gradeFg-c",
        "grade-d": "border-transparent bg-grade-d text-gradeFg-d",
        // 등급 Soft — 연한 틴트 + 진한 글자
        "grade-soft-s": "border-transparent bg-gradeBg-s text-gradeSoftFg-s",
        "grade-soft-a": "border-transparent bg-gradeBg-a text-gradeSoftFg-a",
        "grade-soft-b": "border-transparent bg-gradeBg-b text-gradeSoftFg-b",
        "grade-soft-c": "border-transparent bg-gradeBg-c text-gradeSoftFg-c",
        "grade-soft-d": "border-transparent bg-gradeBg-d text-gradeSoftFg-d",
      },
      shape: {
        label: "rounded-sm",
        pill: "rounded-pill px-3",
      },
      // size: 기본(22px 라벨) 외 — xs=소형 메타 칩 / grade-sm·grade-md=등급 정사각 배지(GradeChip).
      size: {
        default: "",
        xs: "h-5 px-1.5 py-px text-11 font-medium",
        "grade-sm": "size-5 rounded-xs p-0 text-11 leading-none font-bold",
        "grade-md": "size-6 rounded-md p-0 text-12h leading-none font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "label",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

// span — <p>/<button> 안에서도 유효한 인라인 칩(구 StatusBadge/GradeChip 이 span 이었음).
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, shape, size, ...props }, ref) => (
    <span
      ref={ref}
      data-slot="badge"
      className={cn(badgeVariants({ variant, shape, size }), className)}
      {...props}
    />
  )
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
