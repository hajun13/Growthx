'use client';

import { Info, Lightbulb, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// 화면 상단 안내 배너(레퍼런스의 가이드 배너) — 그 화면에서 할 일을 친근하게 안내.
export type InfoBannerTone = 'info' | 'tip' | 'warning' | 'success';

// EnergyX 토큰: info → #EAF1FE/#CDDDFB/#1D4FC4, 나머지는 시맨틱 그대로 유지
const toneStyle: Record<
  InfoBannerTone,
  { wrap: string; icon: string; Icon: LucideIcon }
> = {
  info: {
    wrap: 'border-[#CDDDFB] bg-[#EAF1FE] text-[#173F9B]',
    icon: 'text-[#1D4FC4]',
    Icon: Info,
  },
  tip: {
    wrap: 'border-[#fce6bf] bg-[#fef5e7] text-[#9a6103]',
    icon: 'text-[#c97e04]',
    Icon: Lightbulb,
  },
  warning: {
    wrap: 'border-[#f9cfcf] bg-[#FDECEC] text-[#a0282d]',
    icon: 'text-[#c8353a]',
    Icon: AlertTriangle,
  },
  success: {
    wrap: 'border-[#c9eed7] bg-[#e9f8ef] text-[#0e6633]',
    icon: 'text-[#128240]',
    Icon: CheckCircle2,
  },
};

export interface InfoBannerProps {
  tone?: InfoBannerTone;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function InfoBanner({
  tone = 'info',
  title,
  children,
  action,
  className,
}: InfoBannerProps) {
  const s = toneStyle[tone];
  const Icon = s.Icon;
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-3 border px-4 py-3.5',
        s.wrap,
        className,
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-white/70',
          s.icon,
        )}
        aria-hidden
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {title && <p className="font-bold">{title}</p>}
        <div className={cn(title && 'mt-0.5', 'font-medium opacity-90')}>
          {children}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
