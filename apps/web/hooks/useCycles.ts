'use client';

import { apiGet, apiGetList, apiPost } from '@/lib/api';
import type { EvaluationCycle, CycleStatus } from '@/lib/types';
import { useAsync } from './useAsync';

export function useCycles(params: { status?: CycleStatus; year?: number } = {}) {
  return useAsync(
    () =>
      apiGetList<EvaluationCycle>('/cycles', {
        status: params.status,
        year: params.year,
      }),
    [params.status, params.year],
  );
}

export function useCycle(cycleId: string | null) {
  return useAsync(
    () => apiGet<EvaluationCycle>(`/cycles/${cycleId}`),
    [cycleId],
    { enabled: !!cycleId },
  );
}

export const cycleCommands = {
  create: (body: {
    name: string;
    year: number;
    startDate: string;
    endDate: string;
  }) => apiPost<EvaluationCycle>('/cycles', body),
};
