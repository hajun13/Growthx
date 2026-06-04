'use client';

import { apiGet, apiGetList, apiPatch } from '@/lib/api';
import type {
  KpiCategoryPolicyEntry,
  KpiCategoryAllowed,
  KpiCategoryPolicyInput,
  Position,
} from '@/lib/types';
import { useAsync } from './useAsync';

// GET /kpi-category-policy (hr_admin) → 전체 매트릭스(직급별 allowed).
export function useKpiCategoryPolicy(options: { enabled?: boolean } = {}) {
  return useAsync(
    () => apiGetList<KpiCategoryPolicyEntry>('/kpi-category-policy'),
    [],
    options,
  );
}

// GET /kpi-category-policy/allowed?userId= (인증 전 역할) → KPI 작성용 허용 카테고리.
export function useKpiCategoryAllowed(
  params: { userId?: string; position?: Position } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync<KpiCategoryAllowed>(
    () =>
      apiGet<KpiCategoryAllowed>('/kpi-category-policy/allowed', {
        userId: params.userId,
        position: params.position,
      }),
    [params.userId, params.position],
    options,
  );
}

// ── 명령(쓰기, hr_admin) — 부분 갱신 후 전체 매트릭스 반환 ─────────
export const kpiCategoryPolicyCommands = {
  // PATCH /kpi-category-policy { entries } → 응답은 전체 매트릭스(목록 봉투).
  update: (entries: KpiCategoryPolicyInput[]) =>
    apiPatch<KpiCategoryPolicyEntry[]>('/kpi-category-policy', { entries }),
};
