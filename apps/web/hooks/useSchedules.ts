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
  // phase 기준 일괄 upsert(날짜·알림). isLocked 는 단건 setLock 으로 분리(Cycle Ops §2).
  upsert: (cycleId: string, schedules: ScheduleItemInput[]) =>
    apiPatch<CycleSchedule[]>(`/cycles/${cycleId}/schedules`, { schedules }),
  // Cycle Ops §2: 단건 잠금/열기 토글. 열기(재오픈)는 reason 필수(백엔드 검증).
  setLock: (cycleId: string, phase: string, isLocked: boolean, reason?: string) =>
    apiPatch<CycleSchedule>(`/cycles/${cycleId}/schedules/${phase}`, {
      isLocked,
      ...(reason !== undefined ? { reason } : {}),
    }),
};
