'use client';

import { apiGetList, apiPatch } from '@/lib/api';
import type { CycleSchedule, ScheduleItemInput } from '@/lib/types';
import { useAsync } from './useAsync';

// M2-B2: 주기 단계별 일정·대상자·알림 설정. dueDate 오름차순.
export function useSchedules(
  cycleId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () => apiGetList<CycleSchedule>(`/cycles/${cycleId}/schedules`),
    [cycleId],
    { enabled: !!cycleId && (options.enabled ?? true) },
  );
}

export const scheduleCommands = {
  // phase 기준 일괄 upsert.
  upsert: (cycleId: string, schedules: ScheduleItemInput[]) =>
    apiPatch<CycleSchedule[]>(`/cycles/${cycleId}/schedules`, { schedules }),
};
