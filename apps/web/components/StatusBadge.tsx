'use client';

import {
  evalStatusStyle,
  kpiStatusStyle,
  appealStatusStyle,
  tierStyle,
} from '@/lib/ui';
import { Badge } from '@/components/ui/badge';
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
    <Badge
      variant="secondary"
      aria-label={label}
      className={`min-w-[3.25rem] justify-center border-transparent font-medium ${style.className}`}
    >
      {label}
    </Badge>
  );
}
