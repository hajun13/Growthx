"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

// size: 기본 md(40px) — 앱 공용 4단계(xs 24 / sm 32 / md 40 / lg 56).
const avatarSizeClass = {
  xs: "size-6",
  sm: "size-8",
  md: "",
  lg: "size-14",
} as const
// 폴백 이니셜 글자 크기(아바타 size 와 동일 키).
const avatarFallbackTextClass = {
  xs: "text-10",
  sm: "text-12",
  md: "text-14",
  lg: "text-20",
} as const
// 폴백 파스텔 5색(이름 해시 로테이션 — L2 Avatar 가 선택).
const avatarToneClass = {
  blue: "bg-info-50 text-info-700",
  green: "bg-success-50 text-success-600",
  purple: "bg-purple-50 text-purple-700",
  amber: "bg-warning-50 text-warning-700",
  mint: "bg-brand-teal-subtle text-brand-teal-strong",
} as const

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & {
    size?: keyof typeof avatarSizeClass
  }
>(({ className, size = "md", ...props }, ref) => (
  <AvatarPrimitive.Root
    data-slot="avatar"
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      avatarSizeClass[size],
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    data-slot="avatar-image"
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> & {
    size?: keyof typeof avatarFallbackTextClass
    tone?: keyof typeof avatarToneClass
  }
>(({ className, size = "md", tone, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    data-slot="avatar-fallback"
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted font-semibold leading-none",
      avatarFallbackTextClass[size],
      tone && avatarToneClass[tone],
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
