'use client';

import { apiGetList, apiGet, apiPost } from '@/lib/api';
import type { GroupPerformance, MyGroupPerformance } from '@/lib/types';
import { useAsync } from './useAsync';

export function useGroupPerformance(
  params: { cycleId?: string; groupId?: string } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<GroupPerformance>('/group-performance', {
        cycleId: params.cycleId,
        groupId: params.groupId,
      }),
    [params.cycleId, params.groupId],
    options,
  );
}

// M3 Item 10: 본인 소속 그룹의 목표/실적(KPI 작성 화면 상단 읽기 전용).
// API(requirements-m3.md): GET /group-performance/my-group?cycleId=.
export function useMyGroupPerformance(
  cycleId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGet<MyGroupPerformance>('/group-performance/my-group', {
        cycleId: cycleId ?? undefined,
      }),
    [cycleId],
    { enabled: !!cycleId && (options.enabled ?? true) },
  );
}

export const groupPerformanceCommands = {
  // tier 는 백엔드가 달성률로 자동 분류. upsert.
  upsert: (body: {
    groupId: string;
    cycleId: string;
    revenue?: number;
    orders?: number;
    profit?: number;
    achievementRate: number;
  }) => apiPost<GroupPerformance>('/group-performance', body),
};
