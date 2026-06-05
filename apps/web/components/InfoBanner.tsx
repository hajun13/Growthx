'use client';

import { Info, Lightbulb, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// 화면 상단 안내 배너(레퍼런스의 가이드 배너) — 그 화면에서 할 일을 친근하게 안내.
export type InfoBannerTone = 'info' | 'tip' | 'warning' | 'success';

const toneStyle: Record<
  InfoBannerTone,
  { wrap: string; icon: string; Icon: LucideIcon }
> = {
  info: {
    wrap: 'border-[#BBD6FB] bg-[#EBF3FE] text-[#1B4DCB]',
    icon: 'text-[#1B64DA]',
    Icon: Info,
  },
  tip: {
    wrap: 'border-[#FBE2AE] bg-[#FEF8EA] text-[#8A5A00]',
    icon: 'text-[#C2670E]',
    Icon: Lightbulb,
  },
  warning: {
    wrap: 'border-[#F7C4C4] bg-[#FDECEC] text-[#AE222E]',
    icon: 'text-[#D6303D]',
    Icon: AlertTriangle,
  },
  success: {
    wrap: 'border-[#B6E6CC] bg-[#E7F8EF] text-[#0B7544]',
    icon: 'text-[#0F9457]',
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
