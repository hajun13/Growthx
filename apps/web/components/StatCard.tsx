'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatCardTone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: StatCardTone;
  className?: string;
}

const toneIcon: Record<StatCardTone, string> = {
  default:  'text-muted-foreground',
  primary:  'text-primary',
  success:  'text-success-700',
  warning:  'text-warning-700',
  danger:   'text-danger-700',
  info:     'text-info-700',
};

const toneValue: Record<StatCardTone, string> = {
  default: 'text-foreground',
  primary: 'text-primary',
  success: 'text-success-700',
  warning: 'text-warning-700',
  danger:  'text-danger-700',
  info:    'text-info-700',
};

/**
 * StatCard — 범용 수치 요약.
 * 장식 카드가 아니라 운영 화면 안의 보조 데이터 블록으로 낮게 보이도록 유지한다.
 *
 * 사용 예:
 * <StatCard label="제출률" value="87%" sub="3명 미제출" tone="success" icon={<CheckCircle />} />
 */
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'default',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card px-4 py-3 shadow-elev-1',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold text-muted-foreground">{label}</p>
        {icon && (
          <span
            aria-hidden
            className={cn(
              'flex size-5 shrink-0 items-center justify-center [&_svg]:size-4',
              toneIcon[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>

      <p
        className={cn(
          'mt-2 text-[21px] font-bold leading-none tabular-nums tracking-normal',
          toneValue[tone],
        )}
      >
        {value}
      </p>

      {sub && (
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}
