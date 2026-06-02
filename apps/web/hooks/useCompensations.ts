'use client';

import { apiGetList, apiPost } from '@/lib/api';
import type { Compensation, CompensationMeta } from '@/lib/types';
import { useAsync } from './useAsync';

export function useCompensations(
  params: { cycleId?: string; userId?: string } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<Compensation>('/compensations', {
        cycleId: params.cycleId,
        userId: params.userId,
      }),
    [params.cycleId, params.userId],
    options,
  );
}

export const compensationCommands = {
  // 확정 결과 → RuleSet.raiseRates 인상률 산정. meta 에 전사 평균·초과 플래그.
  // 목록 반환이므로 apiGetList 형태를 직접 호출(POST 이지만 응답이 {data,meta}).
  compute: async (body: { cycleId: string; simulated?: boolean }) => {
    const { apiPostList } = await import('@/lib/api');
    return apiPostList<Compensation, CompensationMeta>(
      '/compensations/compute',
      body,
    );
  },
};
