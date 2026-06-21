import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type LabelTone = 'primary' | 'secondary' | 'purple' | 'blue' | 'green' | 'teal' | 'red' | 'amber' | 'gray' | 'darkgray' | 'lightgray';
type LabelVariant = 'fill' | 'border';

const fillToneClass: Record<LabelTone, string> = {
  primary: 'bg-primary text-primary-foreground',
  purple: 'bg-primary text-primary-foreground',
  blue: 'bg-primary text-primary-foreground',
  green: 'bg-foreground text-background',
  teal: 'bg-foreground text-background',
  amber: 'bg-foreground text-background',
  gray: 'bg-muted text-muted-foreground',
  darkgray: 'bg-foreground text-background',
  secondary: 'bg-foreground text-background',
  red: 'bg-foreground text-background',
  lightgray: 'bg-muted text-muted-foreground',
};

const borderToneClass: Record<LabelTone, string> = {
  primary: 'border-border bg-muted text-primary',
  purple: 'border-border bg-muted text-primary',
  blue: 'border-border bg-muted text-primary',
  green: 'border-border bg-muted text-foreground',
  teal: 'border-border bg-muted text-foreground',
  amber: 'border-border bg-muted text-foreground',
  gray: 'border-border bg-muted text-muted-foreground',
  darkgray: 'border-border bg-muted text-foreground',
  secondary: 'border-border bg-muted text-foreground',
  red: 'border-border bg-muted text-foreground',
  lightgray: 'border-border bg-muted text-muted-foreground',
};

export interface DesignLabelProps extends ComponentPropsWithoutRef<'span'> {
  children: ReactNode;
  tone?: LabelTone;
  variant?: LabelVariant;
}

export function DesignLabel({
  children,
  tone = 'primary',
  variant = 'border',
  className,
  ...props
}: DesignLabelProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[4px] px-3 py-0.5 text-[12px] font-bold leading-[14px]',
        variant === 'border' ? 'border' : 'border border-transparent',
        variant === 'border' ? borderToneClass[tone] : fillToneClass[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
