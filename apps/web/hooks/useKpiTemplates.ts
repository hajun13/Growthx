'use client';

import { apiGet, apiGetList, apiDelete, apiPatch, apiPost } from '@/lib/api';
import type {
  JobLevel,
  KpiTemplate,
  KpiTemplateItemInput,
} from '@/lib/types';
import { useAsync } from './useAsync';

// M2-B1: jobLevel별 KPI 양식 목록.
export function useKpiTemplates(
  params: { cycleId?: string; jobLevel?: JobLevel } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<KpiTemplate>('/kpi-templates', {
        cycleId: params.cycleId,
        jobLevel: params.jobLevel,
      }),
    [params.cycleId, params.jobLevel],
    options,
  );
}

export function useKpiTemplate(id: string | null) {
  return useAsync(() => apiGet<KpiTemplate>(`/kpi-templates/${id}`), [id], {
    enabled: !!id,
  });
}

export const kpiTemplateCommands = {
  create: (body: {
    cycleId: string;
    jobLevel: JobLevel;
    items: KpiTemplateItemInput[];
  }) => apiPost<KpiTemplate>('/kpi-templates', body),
  // 항목 전체 교체.
  update: (id: string, items: KpiTemplateItemInput[]) =>
    apiPatch<KpiTemplate>(`/kpi-templates/${id}`, { items }),
  remove: (id: string) =>
    apiDelete<{ id: string; deleted: boolean }>(`/kpi-templates/${id}`),
};
