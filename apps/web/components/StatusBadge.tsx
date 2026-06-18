'use client';

import {
  evalStatusStyle,
  kpiStatusStyle,
  appealStatusStyle,
  tierStyle,
} from '@/lib/ui';
import { DesignLabel } from '@/components/DesignLabel';
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

function toneForStatus(status: StatusBadgeProps['status']) {
  if (status === 'in_progress' || status === 'approved' || status === 'under_review' || status === 'answered') {
    return 'blue';
  }
  if (status === 'submitted') return 'purple';
  if (status === 'finalized' || status === 'confirmed' || status === 'closed' || status === 'excellent') {
    return 'green';
  }
  if (status === 'rejected' || status === 'revision_requested') return 'red';
  if (status === 'poor') return 'red';
  if (status === 'standard') return 'gray';
  return 'gray';
}

export function StatusBadge({ status, count }: StatusBadgeProps) {
  const style = resolve(status);
  const label = count !== undefined ? `${style.label} ${count}명` : style.label;
  return (
    <DesignLabel
      tone={toneForStatus(status)}
      className="min-w-[52px]"
      aria-label={label}
    >
      {label}
    </DesignLabel>
  );
}
