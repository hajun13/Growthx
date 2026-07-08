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
  /** 공유 키(submitted 등)의 해석 도메인 — KPI 화면은 'kpi' 를 넘겨 결재선 라벨('결재 대기')을 쓴다. */
  domain?: 'kpi' | 'eval';
}

function resolve(status: StatusBadgeProps['status'], domain?: 'kpi' | 'eval') {
  // 우선순위: 명시 도메인 → eval(공유 키 submitted/finalized 는 eval 톤) → kpi → appeal → tier.
  if (domain === 'kpi' && status in kpiStatusStyle) {
    return kpiStatusStyle[status as KpiStatus];
  }
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
  if (status === 'submitted') return 'blue';
  if (status === 'finalized' || status === 'confirmed' || status === 'closed' || status === 'excellent') {
    return 'darkgray';
  }
  if (status === 'rejected' || status === 'revision_requested') return 'gray';
  if (status === 'poor') return 'gray';
  if (status === 'standard') return 'gray';
  return 'gray';
}

export function StatusBadge({ status, count, domain }: StatusBadgeProps) {
  const style = resolve(status, domain);
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
