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
        // 월 탭 바 등 세그먼트형 비활성 항목 — 회색 글씨, hover 시 흰 칩(선택 항목은 default).
        tab: "text-muted-foreground hover:bg-card hover:text-foreground",
        // 등급 선택 버튼(S~D) — data-grade=s|a|b|c|d + data-selected=true 면 해당 등급 Solid 배경. size="grade-pick" 과 함께. (G4b 추가)
        "grade-pick":
          "border-2 border-border bg-card font-bold text-muted-foreground hover:border-border/80 data-[selected=true]:data-[grade=s]:border-grade-s data-[selected=true]:data-[grade=s]:bg-grade-s data-[selected=true]:data-[grade=s]:text-gradeFg-s data-[selected=true]:data-[grade=a]:border-grade-a data-[selected=true]:data-[grade=a]:bg-grade-a data-[selected=true]:data-[grade=a]:text-gradeFg-a data-[selected=true]:data-[grade=b]:border-grade-b data-[selected=true]:data-[grade=b]:bg-grade-b data-[selected=true]:data-[grade=b]:text-gradeFg-b data-[selected=true]:data-[grade=c]:border-grade-c data-[selected=true]:data-[grade=c]:bg-grade-c data-[selected=true]:data-[grade=c]:text-gradeFg-c data-[selected=true]:data-[grade=d]:border-grade-d data-[selected=true]:data-[grade=d]:bg-grade-d data-[selected=true]:data-[grade=d]:text-gradeFg-d",
        // 증빙 파일 행(전폭 muted 박스 + 아이콘/파일명/크기) — size="file-row" 과 함께. (G4b 추가)
        "file-chip":
          "justify-start border-border bg-muted text-left font-normal text-foreground hover:bg-muted/70",
        // 보조 링크형 액션(상세 보기 등) — 그레이 outline + primary 글자. (G4b 추가)
        "outline-primary":
          "border-input bg-card text-primary hover:bg-muted active:bg-border",
        // 중립 아이콘 버튼(칩 안 다운로드/삭제·목록 행 액션) — muted 글자, hover 시 muted 배경+진한 글자. (G4b 추가)
        "ghost-muted":
          "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-border",
        // 선택형 카드 행(이의제기 목록 등) — 테두리 카드, data-selected=true 면 primary 테두리+링. size="row" 와 함께. (G4b 추가)
        "card-row":
          "justify-start rounded-lg border-border bg-card text-left font-normal whitespace-normal text-foreground hover:border-primary/35 data-[selected=true]:border-primary data-[selected=true]:ring-1 data-[selected=true]:ring-primary/25",
        // 퍼플 사이드바 위 컨트롤(접기 토글·그룹 헤더) — 사이드바 전용.
        sidebar:
          "text-sidebar-foreground hover:bg-sidebar-foreground/8 active:bg-sidebar-foreground/12",
        // 인라인 도움말 아이콘 트리거(HelpTooltip) — 원형·muted·hover 시 글자만 진해짐.
        help: "rounded-full text-muted-foreground cursor-help hover:text-foreground focus-visible:ring-foreground/30",
        // 목록 행 전체가 버튼인 항목(알림 행 등) — 좌측 정렬·모서리 없음·줄바꿈 허용.
        row: "justify-start rounded-none border-0 text-left font-normal whitespace-normal text-foreground hover:bg-muted active:bg-muted",
        // 좌측 세로 메뉴 행(평가 운영 등) — 하단 헤어라인 + 좌측 3px 바. 활성: muted 배경 + primary 바. (G6b 추가)
        "menu-row":
          "justify-start rounded-none border-0 border-b border-l-3 border-border border-l-transparent text-left font-medium whitespace-normal text-muted-foreground last:border-b-0 hover:bg-muted/70 active:bg-muted",
        "menu-row-active":
          "justify-start rounded-none border-0 border-b border-l-3 border-border border-l-primary bg-muted text-left font-bold whitespace-normal text-foreground last:border-b-0 hover:bg-muted active:bg-muted",
        // 칩/태그 안 투명 버튼 — 부모(칩) 글자색·크기를 그대로 상속. (G6b 추가)
        bare: "rounded-none border-0 bg-transparent text-inherit",
        // 선택 목록 행(평가 대상 패널 등) — 좌측 3px 선택 바 + data-active=true 면 연한 블루 틴트. (G2 추가)
        "row-select":
          "justify-start rounded-none border-0 border-l-3 border-l-transparent text-left font-normal whitespace-normal text-foreground not-data-[active=true]:hover:bg-muted/60 data-[active=true]:border-l-primary data-[active=true]:bg-primary/8",
        // 점선 추가 버튼(그룹별 항목 추가 등) — 점선 테두리 + hover 시 블루 테두리. size="dashed" 와 함께. (G2 추가)
        dashed:
          "border-dashed border-border bg-card text-foreground hover:border-primary hover:bg-muted/60 disabled:text-muted-foreground disabled:opacity-50",
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
        // 등급 선택 버튼(S~D) — variant="grade-pick" 과 함께. 높이 40·가변 폭(flex-1). (G4b 추가)
        "grade-pick": "h-10 min-w-0 flex-1 text-sm",
        // 증빙 파일 행 크기 — variant="file-chip" 과 함께. (G4b 추가)
        "file-row": "h-auto w-full gap-1.5 px-2.5 py-1.5 text-12",
        // 접기/펴기 카드 헤더 트리거(variant=row 와 함께) — 전폭·세로 중앙·넉넉한 패딩. (G4b 추가)
        collapse: "h-auto w-full items-center gap-3 px-4 py-4 text-sm",
        // 목록 행(variant=row 와 함께) — 전폭·높이 자동. row-dense = 드롭다운용 촘촘한 간격.
        row: "h-auto w-full items-start gap-3 px-3 py-3 text-sm",
        "row-dense": "h-auto w-full items-start gap-3 px-3 py-2.5 text-sm",
        "menu-row": "h-auto w-full gap-3 px-4 py-3.5 text-12h",
        bare: "h-auto gap-0 p-0 font-[inherit] text-[length:inherit] [&_svg:not([class*='size-'])]:size-3",
        "row-select": "h-auto w-full gap-3 px-4 py-3 text-sm",
        dashed: "h-auto w-full flex-col gap-1.5 px-4 py-4 text-13 [&_svg:not([class*='size-'])]:size-5",
        // 역량평가 점수 셀(1~5) 17×24 소형 버튼. (G3 추가)
        score: "h-6 w-4.25 gap-0 rounded-sm px-0 text-11 font-bold tabular-nums",
        // 등급 기준 선택 행(GradeCriteriaPicker) — 좌측 정렬·줄바꿈 허용·readOnly(disabled) 도 흐리지 않음. (G3 추가)
        choice: "h-auto w-full min-w-0 justify-start gap-2 px-2 py-2 text-left text-12 font-normal whitespace-normal disabled:opacity-100",
        // 사이드바 그룹 헤더 행(전폭 · 좌우 정렬).
        "sidebar-group": "flex h-auto w-full justify-between border-0 px-4 py-1 text-11 leading-normal",
        // 문장 속 인라인 텍스트 버튼(브레드크럼 등) — 패딩 0·자동 높이·12px 보통 굵기.
        inline: "h-auto gap-1 rounded-sm p-0 text-xs font-normal",
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
