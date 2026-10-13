import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// 표 변형(추가 전용 — 기본값은 기존 외관 그대로). DataTable 이 정렬·sticky·행 상호작용을 variant 로 선택한다.
const tableRowVariants = cva(
  "border-b border-border/80 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
  {
    variants: {
      // interactive: 클릭 가능한 행(포인터 + hover/focus 틴트).
      interactive: {
        true: "cursor-pointer outline-hidden hover:bg-muted/60 focus-visible:bg-muted/60",
        false: "",
      },
      // plain: hover 틴트 없음(헤더 행·빈 상태 행).
      plain: { true: "hover:bg-transparent", false: "" },
      // rule: strong = 헤더 하단 2px 보더.
      rule: { default: "", strong: "border-b-2 border-border" },
    },
    defaultVariants: { interactive: false, plain: false, rule: "default" },
  }
)

const tableHeadVariants = cva(
  "h-10 bg-muted px-3 text-left align-middle text-xs font-semibold whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
  {
    variants: {
      // tone: soft = 옅은 헤더(bg-muted/70) · strong = 또렷한 헤더(진한 텍스트).
      tone: {
        default: "",
        soft: "bg-muted/70",
        strong: "text-foreground",
      },
      // sticky: 스크롤 컨테이너 안에서 상단 고정 — border-collapse 에선 tr 보더가 안 따라오므로 inset 하단선.
      sticky: {
        true: "sticky top-0 z-10 shadow-[inset_0_-1px_0_0_var(--border)]",
        false: "",
      },
      textAlign: { left: "text-left", right: "text-right", center: "text-center" },
    },
    defaultVariants: { tone: "default", sticky: false, textAlign: "left" },
  }
)

const tableCellVariants = cva(
  "px-3 py-2.5 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
  {
    variants: {
      textAlign: { left: "text-left", right: "text-right", center: "text-center" },
      // flush: 패딩 제거(셀 안에 빈 상태 등 블록을 꽉 채울 때).
      flush: { true: "p-0", false: "" },
    },
    defaultVariants: { flush: false }, // textAlign 미지정 = 기존 외관(상속) 유지
  }
)

// DESIGN.md §7 — 헤더 bg-muted(#F4F5FA) · 행 구분 헤어라인 · 컬러 행 배경 금지(hover 틴트만) · sticky 헤더 허용.
const Table = React.forwardRef<
  HTMLTableElement,
  React.ComponentProps<"table"> & {
    /**
     * true 면 내부 overflow 래퍼 없이 <table> 만 렌더.
     * 호출부가 스크롤 컨테이너를 직접 소유할 때(예: DataTable sticky header) 사용 —
     * 스크롤 컨테이너가 이중이면 sticky th 가 동작하지 않는다.
     */
    bare?: boolean
  }
>(({ className, bare = false, ...props }, ref) => {
  const table = (
    <table
      ref={ref}
      data-slot="table"
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  )
  if (bare) return table
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-auto"
    >
      {table}
    </div>
  )
})
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentProps<"thead">
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    data-slot="table-header"
    className={cn("[&_tr]:border-b", className)}
    {...props}
  />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentProps<"tbody">
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    data-slot="table-body"
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentProps<"tfoot">
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    data-slot="table-footer"
    className={cn(
      "border-t bg-muted font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.ComponentProps<"tr"> & VariantProps<typeof tableRowVariants>
>(({ className, interactive, plain, rule, ...props }, ref) => (
  <tr
    ref={ref}
    data-slot="table-row"
    className={cn(tableRowVariants({ interactive, plain, rule }), className)}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ComponentProps<"th"> & VariantProps<typeof tableHeadVariants>
>(({ className, tone, sticky, textAlign, ...props }, ref) => (
  <th
    ref={ref}
    data-slot="table-head"
    className={cn(tableHeadVariants({ tone, sticky, textAlign }), className)}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.ComponentProps<"td"> & VariantProps<typeof tableCellVariants>
>(({ className, textAlign, flush, ...props }, ref) => (
  <td
    ref={ref}
    data-slot="table-cell"
    className={cn(tableCellVariants({ textAlign, flush }), className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.ComponentProps<"caption">
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    data-slot="table-caption"
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
