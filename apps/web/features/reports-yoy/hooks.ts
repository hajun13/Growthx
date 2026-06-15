'use client';

/**
 * reports-yoy feature — 데이터 훅.
 * 생성 클라이언트(@growthx/contracts) 기반 api.ts 를 useAsync 로 감싼다.
 * 반환 계약은 기존 useYoyCompare·useYoyDistribution 와 동일({ data, loading, error, reload }).
 */
import type {
  CompareResult,
  DistributionResult,
  DistributionScope,
  LegalEntity,
} from '@/lib/types';
import { useAsync } from '@/hooks/useAsync';
import { fetchYoyCompare, fetchYoyDistribution } from './api';

// userId 생략 시 본인 기준(백엔드 행수준 권한). cycleIds 생략 시 결과가 있는 전 사이클.
export function useYoyCompare(
  params: { userId?: string | null; cycleIds?: string[] } = {},
  options: { enabled?: boolean } = {},
) {
  const cycleIdsKey = (params.cycleIds ?? []).join(',');
  return useAsync<CompareResult>(
    () => fetchYoyCompare({ userId: params.userId, cycleIds: params.cycleIds }),
    [params.userId, cycleIdsKey],
    options,
  );
}

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
  return useAsync<DistributionResult>(
    () =>
      fetchYoyDistribution({
        scope: params.scope,
        deptId: params.deptId,
        cycleIds: params.cycleIds,
        legalEntity: params.legalEntity,
      }),
    [params.scope, params.deptId, cycleIdsKey, legalEntity],
    options,
  );
}
