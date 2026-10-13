import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

// DESIGN.md §7 — 주요/승인만 primary solid, 보조·반려는 그레이 outline, 파괴적=red outline, 링크형=블루 텍스트.
// 높이는 기존 화면 패리티: xs 28 / sm 32 / default 40 / lg 48 (표 내부는 xs·sm).
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm font-semibold whitespace-nowrap transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-brand-blue-hover active:bg-purple-700",
        outline:
          "border-input bg-card text-secondary-foreground hover:bg-muted active:bg-border",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-border active:bg-input",
        ghost: "text-primary hover:bg-accent active:bg-purple-100",
        destructive:
          "border-destructive bg-card text-destructive hover:bg-destructive/5 active:bg-destructive/10",
        link: "text-primary underline-offset-4 hover:underline",
        // 퍼플 사이드바 위 컨트롤(접기 토글·그룹 헤더) — 사이드바 전용.
        sidebar:
          "text-sidebar-foreground hover:bg-sidebar-foreground/8 active:bg-sidebar-foreground/12",
        // 인라인 도움말 아이콘 트리거(HelpTooltip) — 원형·muted·hover 시 글자만 진해짐.
        help: "rounded-full text-muted-foreground cursor-help hover:text-foreground focus-visible:ring-foreground/30",
      },
      size: {
        default: "h-10 px-4 text-sm [&_svg:not([class*='size-'])]:size-4.5",
        xs: "h-7 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 text-[13px]",
        lg: "h-12 px-5 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
        "icon-2xs": "size-5 [&_svg:not([class*='size-'])]:size-4",
        // 사이드바 그룹 헤더 행(전폭 · 좌우 정렬).
        "sidebar-group": "h-auto w-full justify-between border-0 px-4 py-1 text-11 leading-normal",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** 진행 중 — 스피너 표시 + 비활성화(aria-busy). 로딩 버튼 패턴은 이 prop 하나로 통일. */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      loading = false,
      disabled,
      children,
      type,
      ...props
    },
    ref
  ) => {
    if (asChild) {
      return (
        <Slot.Root
          ref={ref}
          data-slot="button"
          data-variant={variant}
          data-size={size}
          className={cn(buttonVariants({ variant, size, className }))}
          {...props}
        >
          {children}
        </Slot.Root>
      )
    }
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {loading && <Spinner aria-hidden role="presentation" aria-label={undefined} />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
export type { ButtonProps }
