'use client';

import { Info, Lightbulb, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// 화면 상단 안내 배너 — 운영 콘솔 톤에 맞춘 절제형 노트.
export type InfoBannerTone = 'info' | 'tip' | 'warning' | 'success';

const toneStyle: Record<
  InfoBannerTone,
  { accent: string; icon: string; Icon: LucideIcon }
> = {
  info: {
    accent: 'border-l-info-500',
    icon: 'text-info-600',
    Icon: Info,
  },
  tip: {
    accent: 'border-l-warning-500',
    icon: 'text-warning-600',
    Icon: Lightbulb,
  },
  warning: {
    accent: 'border-l-danger-500',
    icon: 'text-danger-600',
    Icon: AlertTriangle,
  },
  success: {
    accent: 'border-l-success-600',
    icon: 'text-success-600',
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
        'flex items-start gap-2.5 rounded-none border border-l-2 border-border bg-card px-3.5 py-2.5 text-foreground shadow-none',
        s.accent,
        className,
      )}
    >
      <span
        className={cn(
          'mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center',
          s.icon,
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 text-[12.5px] leading-5">
        {title && <p className="font-semibold text-foreground">{title}</p>}
        <div className={cn(title && 'mt-0.5', 'font-medium text-muted-foreground')}>
          {children}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
