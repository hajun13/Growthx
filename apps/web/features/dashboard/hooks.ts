'use client';

import { useAsync, type AsyncState } from '@/hooks/useAsync';
import {
  fetchDashboardSummary,
  fetchCompanyAchievement,
  type DashboardSummary,
  type CompanyAchievement,
} from './api';

/**
 * HR 대시보드 위젯 집계 — GET /dashboard/summary.
 * 생성 클라이언트(@growthx/contracts) 기반. cycleId 미지정 시 백엔드가 최신 active 주기 사용.
 */
export function useDashboardSummary(
  cycleId: string | null | undefined,
  options: { enabled?: boolean } = {},
): AsyncState<DashboardSummary> {
  return useAsync(() => fetchDashboardSummary(cycleId), [cycleId], options);
}

/** 전사 목표 달성률 위젯 — GET /dashboard/company-achievement. */
export function useCompanyAchievement(
  cycleId: string | null | undefined,
  options: { enabled?: boolean } = {},
): AsyncState<CompanyAchievement> {
  return useAsync(() => fetchCompanyAchievement(cycleId), [cycleId], options);
}
