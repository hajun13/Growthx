'use client';

import { apiGet } from '@/lib/api';
import type { DashboardSummary, CompanyAchievement } from '@/lib/types';
import { useAsync } from './useAsync';

// M2-C3: HR 대시보드 위젯 집계. cycleId 미지정 시 백엔드가 최신 active 주기 사용.
export function useDashboard(
  cycleId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGet<DashboardSummary>('/dashboard/summary', {
        cycleId: cycleId ?? undefined,
      }),
    [cycleId],
    options,
  );
}

// 전사 목표 달성률 위젯 — GET /dashboard/company-achievement.
export function useCompanyAchievement(
  cycleId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGet<CompanyAchievement>('/dashboard/company-achievement', {
        cycleId: cycleId ?? undefined,
      }),
    [cycleId],
    options,
  );
}
