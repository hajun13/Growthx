'use client';

// 연도 누적(YoY) 조직 등급분포 — GET /results/distribution?scope=&deptId=&cycleIds=&legalEntity=
// 계약 contract-yoy.md §4 와 1:1. 단건 봉투({data}) → DistributionResult.

import { apiGet } from '@/lib/api';
import type {
  DistributionResult,
  DistributionScope,
  LegalEntity,
} from '@/lib/types';
import { useAsync } from './useAsync';

export function useYoyDistribution(
  params: {
    scope?: DistributionScope;
    deptId?: string | null;
    cycleIds?: string[];
    // 'all' 은 미전송(전체 법인). energyx|mirae_plan 만 필터로 전송.
    legalEntity?: LegalEntity | 'all';
  } = {},
  options: { enabled?: boolean } = {},
) {
  const cycleIdsKey = (params.cycleIds ?? []).join(',');
  const legalEntity =
    params.legalEntity && params.legalEntity !== 'all'
      ? params.legalEntity
      : undefined;
  return useAsync(
    () =>
      apiGet<DistributionResult>('/results/distribution', {
        scope: params.scope,
        deptId: params.deptId ?? undefined,
        cycleIds: cycleIdsKey || undefined,
        legalEntity,
      }),
    [params.scope, params.deptId, cycleIdsKey, legalEntity],
    options,
  );
}
