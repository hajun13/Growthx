'use client';

import { Loader2 } from 'lucide-react';
import { getButtonClasses } from '@energyx/ui';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  children: React.ReactNode;
}

// 도메인 variant → EnergyX design-system variant 매핑.
const variantMap = {
  primary: 'contained',
  secondary: 'outlined',
  ghost: 'text',
  // 파괴적 액션은 red solid 금지 — 흰 배경 + red 보더/텍스트(DESIGN.md §7).
  danger: 'outlined',
} as const;

// 도메인 size → EnergyX design-system size 매핑.
const sizeMap = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
} as const;

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  disabled,
  leftIcon,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        getButtonClasses({
          variant: variantMap[variant],
          size: sizeMap[size],
          disabled: isDisabled,
          leftIcon: loading || leftIcon,
          children: true,
        }),
        variant === 'danger' &&
          'border-destructive bg-card text-destructive hover:bg-destructive/5 active:bg-destructive/10',
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {!loading && leftIcon}
      {children}
    </button>
  );
}
