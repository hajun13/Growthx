'use client';

// 연도 누적(YoY) 개인 비교 — GET /results/compare?userId=&cycleIds=
// 계약 contract-yoy.md §4 와 1:1. 단건 봉투({data}) → CompareResult.

import { apiGet } from '@/lib/api';
import type { CompareResult } from '@/lib/types';
import { useAsync } from './useAsync';

// userId 생략 시 본인 기준(백엔드 행수준 권한). cycleIds 생략 시 결과가 있는 전 사이클.
export function useYoyCompare(
  params: { userId?: string | null; cycleIds?: string[] } = {},
  options: { enabled?: boolean } = {},
) {
  const cycleIdsKey = (params.cycleIds ?? []).join(',');
  return useAsync(
    () =>
      apiGet<CompareResult>('/results/compare', {
        userId: params.userId ?? undefined,
        // 빈 배열이면 미전송(전 사이클). 콤마 구분.
        cycleIds: cycleIdsKey || undefined,
      }),
    [params.userId, cycleIdsKey],
    options,
  );
}
