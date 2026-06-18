import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // primary — 솔리드 퍼플 (번들: .exd-btn--primary)
        default:
          "bg-primary text-primary-foreground hover:bg-purple-600 active:bg-purple-700 shadow-none",
        // destructive — danger 솔리드 (번들: .exd-btn--danger)
        destructive:
          "bg-destructive text-white hover:bg-danger-600 active:bg-danger-700 shadow-none",
        // outline — secondary (번들: .exd-btn--secondary)
        outline:
          "border border-border bg-card text-foreground hover:bg-muted hover:border-border/80 active:bg-muted/80 shadow-none",
        // secondary — subtle 퍼플 틴트 (번들: .exd-btn--subtle)
        secondary:
          "bg-purple-50 text-purple-700 hover:bg-purple-100 active:bg-purple-100 shadow-none",
        // ghost — tertiary (번들: .exd-btn--tertiary)
        ghost: "hover:bg-muted active:bg-neutral-200 text-foreground shadow-none",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5 text-sm",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
