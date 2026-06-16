'use client';

import { Loader2 } from 'lucide-react';
import { Button as UIButton } from '@/components/ui/button';
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

// 도메인 variant → shadcn variant 매핑.
const variantMap = {
  primary: 'default',
  secondary: 'outline',
  ghost: 'ghost',
  danger: 'destructive',
} as const;

// 도메인 size → shadcn size 매핑.
const sizeMap = {
  sm: 'sm',
  md: 'default',
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
    <UIButton
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      variant={variantMap[variant]}
      size={sizeMap[size]}
      className={cn(fullWidth && 'w-full', className)}
      {...rest}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {!loading && leftIcon}
      {children}
    </UIButton>
  );
}
