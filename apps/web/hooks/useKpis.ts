'use client';

import { apiGet, apiGetList, apiPost, apiPatch, apiDelete } from '@/lib/api';
import type {
  Kpi,
  KpiReview,
  KpiStatus,
  KpiGroup,
  KpiCategory,
  CreateKpiRequest,
  UpdateKpiRequest,
} from '@/lib/types';
import { useAsync } from './useAsync';

export function useKpis(
  params: {
    cycleId?: string;
    userId?: string;
    status?: KpiStatus;
    group?: KpiGroup;
    category?: KpiCategory;
  } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<Kpi>('/kpis', {
        cycleId: params.cycleId,
        userId: params.userId,
        status: params.status,
        group: params.group,
        category: params.category,
      }),
    [params.cycleId, params.userId, params.status, params.group, params.category],
    options,
  );
}

// KPI 검토 의견 이력 — cycleId·userId 또는 kpiId 단위로 조회(최신순).
export function useKpiReviews(
  params: { cycleId?: string; userId?: string; kpiId?: string } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<KpiReview>('/kpis/reviews', {
        cycleId: params.cycleId,
        userId: params.userId,
        kpiId: params.kpiId,
      }),
    [params.cycleId, params.userId, params.kpiId],
    options,
  );
}

export function useKpi(kpiId: string | null) {
  return useAsync(() => apiGet<Kpi>(`/kpis/${kpiId}`), [kpiId], {
    enabled: !!kpiId,
  });
}

// ── 명령(쓰기) — 봉투 unwrap 후 data 반환 ─────────────────────
export const kpiCommands = {
  create: (body: CreateKpiRequest) => apiPost<Kpi>('/kpis', body),
  update: (id: string, body: UpdateKpiRequest) =>
    apiPatch<Kpi>(`/kpis/${id}`, body),
  remove: (id: string) =>
    apiDelete<{ id: string; deleted: boolean }>(`/kpis/${id}`),
  submit: (id: string) => apiPost<Kpi>(`/kpis/${id}/submit`),
  // 계약 §8 approve: { comment? } → 검토 의견을 Review(strength)로 영속화.
  approve: (id: string, comment?: string) =>
    apiPost<Kpi>(`/kpis/${id}/approve`, comment ? { comment } : undefined),
  // 계약 §8 reject: { reason(필수), comment? } → reject reason + Review(improvement).
  reject: (id: string, reason: string, comment?: string) =>
    apiPost<Kpi>(
      `/kpis/${id}/reject`,
      comment ? { reason, comment } : { reason },
    ),
  confirm: (id: string) => apiPost<Kpi>(`/kpis/${id}/confirm`),
  link: (id: string, parentKpiId: string) =>
    apiPost<Kpi>(`/kpis/${id}/link`, { parentKpiId }),
};
