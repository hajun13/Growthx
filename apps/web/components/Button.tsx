'use client';

import { cx } from '@/lib/ui';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  children: React.ReactNode;
}

const variantClass: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary-500 text-neutral-0 hover:bg-primary-600',
  secondary:
    'bg-neutral-0 text-neutral-800 border border-neutral-300 hover:bg-neutral-50',
  ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100',
  danger: 'bg-danger-500 text-neutral-0 hover:bg-danger-600',
};

const sizeClass: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-4 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-6 text-md',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  disabled,
  leftIcon,
  onClick,
  type = 'button',
  children,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold outline-none transition-colors duration-fast focus-visible:shadow-focus',
        sizeClass[size],
        isDisabled
          ? 'cursor-not-allowed bg-neutral-200 text-neutral-400 hover:bg-neutral-200'
          : variantClass[variant],
        fullWidth && 'w-full',
      )}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {!loading && leftIcon}
      {children}
    </button>
  );
}
