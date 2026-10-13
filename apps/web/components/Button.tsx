'use client';

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

const variantMap = {
  primary: 'default',
  secondary: 'outline',
  ghost: 'ghost',
  danger: 'destructive',
} as const;

const sizeMap = { sm: 'sm', md: 'default', lg: 'lg' } as const;

/**
 * @deprecated — L1(@/components/ui/button) 사용으로 이관 대상.
 * 레거시 variant/size 이름을 L1 으로 위임하는 호환 래퍼.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  leftIcon,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <UIButton
      variant={variantMap[variant]}
      size={sizeMap[size]}
      loading={loading}
      className={cn(fullWidth && 'w-full', className)}
      {...rest}
    >
      {!loading && leftIcon}
      {children}
    </UIButton>
  );
}
