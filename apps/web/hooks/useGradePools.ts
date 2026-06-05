'use client';

import { apiGetList, apiPost, apiPatch } from '@/lib/api';
import type { GradePool } from '@/lib/types';
import { useAsync } from './useAsync';

export function useGradePools(
  params: { cycleId?: string; groupId?: string } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<GradePool>('/grade-pools', {
        cycleId: params.cycleId,
        groupId: params.groupId,
      }),
    [params.cycleId, params.groupId],
    options,
  );
}

export const gradePoolCommands = {
  // 그룹 실적 tier → RuleSet.poolRatios 적용해 GradePool upsert.
  compute: (body: { cycleId: string; groupId: string }) =>
    apiPost<GradePool>('/grade-pools/compute', body),
  // HR 수동 비율 조정 — 지정 등급 비율만 갱신(PATCH /grade-pools/:id).
  update: (
    id: string,
    body: {
      sRatio?: number;
      aRatio?: number;
      bRatio?: number;
      cRatio?: number;
      dRatio?: number;
    },
  ) => apiPatch<GradePool>(`/grade-pools/${id}`, body),
};
