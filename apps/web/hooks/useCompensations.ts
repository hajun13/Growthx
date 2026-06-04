'use client';

import { apiGet, apiGetList, apiPost, apiPatch } from '@/lib/api';
import type {
  Compensation,
  CompensationMeta,
  CompensationSimulation,
} from '@/lib/types';
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

// M3 Item 8: 개인 연봉 시뮬레이션(현재 연봉→등급→인상률→예상 연봉).
// API(requirements-m3.md): GET /compensations/simulation?cycleId=&userId=.
export function useCompensationSimulation(
  params: { cycleId?: string; userId?: string } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGet<CompensationSimulation>('/compensations/simulation', {
        cycleId: params.cycleId,
        userId: params.userId,
      }),
    [params.cycleId, params.userId],
    {
      enabled:
        !!params.cycleId && !!params.userId && (options.enabled ?? true),
    },
  );
}

// M3 Item 8: 팀 전체 시뮬레이션(관리자).
// API: GET /compensations/simulation/team?cycleId=&departmentId=.
export function useTeamCompensationSimulation(
  params: { cycleId?: string; departmentId?: string } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<CompensationSimulation>('/compensations/simulation/team', {
        cycleId: params.cycleId,
        departmentId: params.departmentId,
      }),
    [params.cycleId, params.departmentId],
    { enabled: !!params.cycleId && (options.enabled ?? true) },
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
  // M3 Item 8: 현재 연봉 입력(hr_admin). PATCH /users/:id/salary.
  setSalary: (userId: string, currentSalary: number) =>
    apiPatch<{ id: string; currentSalary: number }>(
      `/users/${userId}/salary`,
      { currentSalary },
    ),
};
