'use client';

import { cn } from '@/lib/utils';

export type StatCardTone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: StatCardTone;
  className?: string;
}

const toneIcon: Record<StatCardTone, string> = {
  default:  'bg-neutral-100 text-neutral-600',
  primary:  'bg-purple-100 text-purple-700',
  success:  'bg-success-50 text-success-700',
  warning:  'bg-warning-50 text-warning-700',
  danger:   'bg-danger-50 text-danger-700',
  info:     'bg-info-50 text-info-700',
};

const toneValue: Record<StatCardTone, string> = {
  default: 'text-foreground',
  primary: 'text-purple-700',
  success: 'text-success-700',
  warning: 'text-warning-700',
  danger:  'text-danger-700',
  info:    'text-info-700',
};

/**
 * StatCard — 범용 수치 통계 카드.
 * ScoreCard(평가 점수 도메인 특화)와 별개 — 범용 KPI/대시보드 지표 표시용.
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
        'rounded-lg border border-border bg-card shadow-elev-1 p-6',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span
            aria-hidden
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-md [&_svg]:size-5',
              toneIcon[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>

      <p
        className={cn(
          'mt-2 text-[34px] font-extrabold leading-none tabular-nums',
          toneValue[tone],
        )}
      >
        {value}
      </p>

      {sub && (
        <p className="mt-2 text-sm text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}
