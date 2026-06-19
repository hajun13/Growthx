'use client';

import { Loader2 } from 'lucide-react';
import { getButtonClasses } from '@energyx/v2-design-system';
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
  danger: 'contained',
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
          'border-destructive bg-destructive hover:bg-danger-600 active:bg-danger-700',
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
