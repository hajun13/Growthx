'use client';

// M3 Item 5: 현재 활성 phase + 잠금 상태.
// API(requirements-m3.md): GET /cycles/:id/current-phase → { phase, dueDate, isLocked, daysRemaining }.
// 임직원 배너·KPI 작성 잠금 가드에서 사용. 백엔드 미배포 시 404 → null(가드 비활성).

import { apiGet } from '@/lib/api';
import type { CurrentPhase } from '@/lib/types';
import { useAsync } from './useAsync';

export function useCurrentPhase(
  cycleId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () => apiGet<CurrentPhase>(`/cycles/${cycleId}/current-phase`),
    [cycleId],
    { enabled: !!cycleId && (options.enabled ?? true) },
  );
}
