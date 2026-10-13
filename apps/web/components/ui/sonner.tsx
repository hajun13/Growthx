"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

// Part 토큰 매핑. 구 구현의 `.toaster`/`.toast` 클래스 셀렉터는 lint(no-unknown-classes) 대상이라
// sonner 가 렌더하는 data 속성 셀렉터(data-sonner-toaster / data-sonner-toast)로 치환 — 동일 특이도.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="group"
      toastOptions={{
        classNames: {
          toast:
            "group group-data-[sonner-toaster]:bg-background group-data-[sonner-toaster]:text-foreground group-data-[sonner-toaster]:border-border group-data-[sonner-toaster]:shadow-none",
          description: "group-data-[sonner-toast]:text-muted-foreground",
          actionButton:
            "group-data-[sonner-toast]:bg-primary group-data-[sonner-toast]:text-primary-foreground",
          cancelButton:
            "group-data-[sonner-toast]:bg-muted group-data-[sonner-toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
