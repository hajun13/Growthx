import * as React from "react"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

// lucide 아이콘은 forwardRef 컴포넌트 — ref 를 그대로 svg 로 전달.
const Spinner = React.forwardRef<SVGSVGElement, React.ComponentProps<"svg">>(
  ({ className, ...props }, ref) => (
    <Loader2Icon
      ref={ref}
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
)
Spinner.displayName = "Spinner"

export { Spinner }
