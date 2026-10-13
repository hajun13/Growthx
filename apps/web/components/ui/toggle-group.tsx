"use client"

import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
  }
>({
  size: "default",
  variant: "default",
  spacing: 0,
})

// variant="outline" + spacing=0 = 앱의 SegmentedControl 외관:
// 흰 박스(border + p-0.5) 안에서 선택 항목만 bg-muted · font-semibold · text-foreground.
const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleVariants> & {
      spacing?: number
    }
>(({ className, variant, size, spacing = 0, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    data-slot="toggle-group"
    data-variant={variant}
    data-size={size}
    data-spacing={spacing}
    style={{ "--gap": spacing } as React.CSSProperties}
    className={cn(
      "group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md",
      "data-[variant=outline]:data-[spacing=0]:inline-flex data-[variant=outline]:data-[spacing=0]:border data-[variant=outline]:data-[spacing=0]:border-border data-[variant=outline]:data-[spacing=0]:bg-card data-[variant=outline]:data-[spacing=0]:p-0.5",
      className
    )}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size, spacing }}>
      {children}
    </ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
))
ToggleGroup.displayName = "ToggleGroup"

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)
  const v = context.variant || variant
  const s = context.size || size
  const segmented = v === "outline" && !context.spacing

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      data-slot="toggle-group-item"
      data-variant={v}
      data-size={s}
      data-spacing={context.spacing}
      className={cn(
        // segmented: 테두리는 컨테이너가 담당 → 항목은 투명 바탕(default 변형)에 선택 틴트만
        toggleVariants({ variant: segmented ? "default" : v, size: s }),
        "w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10",
        segmented
          ? "h-auto rounded-sm px-3 py-1.5 font-medium text-muted-foreground hover:bg-transparent hover:text-foreground data-[size=sm]:px-2.5 data-[size=sm]:py-1 data-[size=sm]:text-xs data-[state=on]:bg-muted data-[state=on]:font-semibold data-[state=on]:text-foreground"
          : "data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md",
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
})
ToggleGroupItem.displayName = "ToggleGroupItem"

export { ToggleGroup, ToggleGroupItem }
