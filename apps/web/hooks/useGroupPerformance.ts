'use client';

import { apiGetList, apiPost } from '@/lib/api';
import type { GroupPerformance } from '@/lib/types';
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
