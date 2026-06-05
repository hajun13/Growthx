'use client';

import { apiGet, apiGetList, apiPatch, apiPost } from '@/lib/api';
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
  update: (
    id: string,
    body: { name?: string; startDate?: string; endDate?: string; year?: number },
  ) => apiPatch<EvaluationCycle>(`/cycles/${id}`, body),
  updateStatus: (id: string, status: CycleStatus) =>
    apiPatch<EvaluationCycle>(`/cycles/${id}/status`, { status }),
};
