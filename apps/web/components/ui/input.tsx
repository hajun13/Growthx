import * as React from "react"
import { cn } from "@/lib/utils"

// Part 하이브리드: h-10(40px) · rounded-md(8px) · border-input · 흰 배경(bg-card).
// tone="accent" = 강조 수치 입력(KPI 가중치 등) — 연한 블루 바탕 + 블루 글씨. (G2 추가)
const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { tone?: "default" | "accent" }
>(
  ({ className, type, tone = "default", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "flex h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-xs transition-[color,box-shadow] outline-hidden",
          "selection:bg-primary selection:text-primary-foreground",
          "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground",
          "hover:border-border/80",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          tone === "accent" && "bg-primary/7 text-primary",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
