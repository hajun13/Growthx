import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type LabelTone = 'primary' | 'secondary' | 'purple' | 'blue' | 'green' | 'teal' | 'red' | 'amber' | 'gray' | 'darkgray' | 'lightgray';
type LabelVariant = 'fill' | 'border';

const fillToneClass: Record<LabelTone, string> = {
  primary: 'bg-[#7A37D8] text-white',
  purple: 'bg-[#7A37D8] text-white',
  blue: 'bg-[#1D4FC4] text-white',
  green: 'bg-[#128240] text-white',
  teal: 'bg-[#4DBFB8] text-white',
  amber: 'bg-[#C97E04] text-white',
  gray: 'bg-[#727174] text-white',
  darkgray: 'bg-[#CDCCCF] text-white',
  secondary: 'bg-[#128240] text-white',
  red: 'bg-[#FF3F56] text-white',
  lightgray: 'bg-[#F6F6F6] text-[#9F9DA1]',
};

const borderToneClass: Record<LabelTone, string> = {
  primary: 'border-[#7A37D8] bg-[#EDF0F0] text-[#7A37D8]',
  purple: 'border-[#7A37D8] bg-[#EDF0F0] text-[#7A37D8]',
  blue: 'border-[#1D4FC4] bg-[#EDF0F0] text-[#1D4FC4]',
  green: 'border-[#128240] bg-[#EDF0F0] text-[#128240]',
  teal: 'border-[#4DBFB8] bg-[#EDF0F0] text-[#4DBFB8]',
  amber: 'border-[#C97E04] bg-[#EDF0F0] text-[#9A6103]',
  gray: 'border-[#727174] bg-[#EDF0F0] text-[#727174]',
  darkgray: 'border-[#727174] bg-[#EDF0F0] text-[#727174]',
  secondary: 'border-[#4DBFB8] bg-[#EDF0F0] text-[#4DBFB8]',
  red: 'border-[#FF3F56] bg-[#EDF0F0] text-[#FF3F56]',
  lightgray: 'border-[#B4B4B6] bg-[#EDF0F0] text-[#B4B4B6]',
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
        'inline-flex h-[22px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[2px] px-3 py-0.5 text-[12px] font-bold leading-[14px]',
        variant === 'border' ? 'border-2' : 'border border-transparent',
        variant === 'border' ? borderToneClass[tone] : fillToneClass[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
