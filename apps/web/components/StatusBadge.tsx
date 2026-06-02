'use client';

import {
  cx,
  evalStatusStyle,
  kpiStatusStyle,
  appealStatusStyle,
  tierStyle,
} from '@/lib/ui';
import type {
  EvalStatus,
  KpiStatus,
  AppealStatus,
  PoolTier,
} from '@/lib/types';

export interface StatusBadgeProps {
  status: EvalStatus | KpiStatus | AppealStatus | PoolTier;
  count?: number;
}

function resolve(status: StatusBadgeProps['status']) {
  // 우선순위: eval(공유 키 submitted/finalized 는 eval 톤) → kpi → appeal → tier.
  if (status in evalStatusStyle && status in kpiStatusStyle) {
    return evalStatusStyle[status as EvalStatus];
  }
  if (status in evalStatusStyle) return evalStatusStyle[status as EvalStatus];
  if (status in kpiStatusStyle) return kpiStatusStyle[status as KpiStatus];
  if (status in appealStatusStyle)
    return appealStatusStyle[status as AppealStatus];
  return tierStyle[status as PoolTier];
}

export function StatusBadge({ status, count }: StatusBadgeProps) {
  const style = resolve(status);
  const label = count !== undefined ? `${style.label} ${count}명` : style.label;
  return (
    <span
      aria-label={label}
      className={cx(
        'inline-flex items-center rounded-full px-2 py-[2px] text-xs font-medium',
        style.className,
      )}
    >
      {label}
    </span>
  );
}
