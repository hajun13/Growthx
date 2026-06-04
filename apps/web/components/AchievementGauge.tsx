'use client';

import { cn } from '@/lib/utils';
import { fmtPercent } from '@/lib/ui';

export interface AchievementGaugeProps {
  // 달성률(%) — 백엔드 값 그대로. 100 초과 가능(capped 표시).
  rate: number;
  label?: string;
  className?: string;
}

// 누적 달성률 가로 게이지. 그룹/팀 목표 카드·KPI 상단 공용.
export function AchievementGauge({
  rate,
  label,
  className,
}: AchievementGaugeProps) {
  const clamped = Math.max(0, Math.min(100, rate));
  // 100% 이상은 success, 90% 이상 primary, 그 외 warning 톤.
  const tone =
    rate >= 100
      ? 'bg-success-500'
      : rate >= 90
        ? 'bg-primary'
        : 'bg-warning-500';

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label ?? '달성률'}</span>
        <span className="font-bold tabular-nums text-foreground">
          {fmtPercent(rate)}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${label ?? '달성률'} ${fmtPercent(rate)}`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-all', tone)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
