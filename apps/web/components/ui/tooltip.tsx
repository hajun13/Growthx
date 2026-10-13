"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

// 번들 스펙(Tooltip.jsx): 배경 ink(foreground) · rounded-md · 최대 260px. z-[120]: 모달 위에서도 노출.
// variant="rich": 도움말 툴팁(HelpTooltip) — 넓은 패딩·최대 328px·그림자.
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    variant?: "default" | "rich"
  }
>(({ className, sideOffset = 6, variant = "default", ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      data-slot="tooltip-content"
      sideOffset={sideOffset}
      className={cn(
        "z-[120] max-w-[260px] origin-(--radix-tooltip-content-transform-origin) overflow-hidden rounded-md bg-foreground px-3 py-1.5 text-xs leading-relaxed font-medium text-background",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        variant === "rich" && "max-w-82 px-4 py-4 text-12 leading-4.5 font-normal shadow-md",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
