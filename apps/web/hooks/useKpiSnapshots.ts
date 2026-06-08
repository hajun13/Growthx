'use client';

// Cycle Ops §4: 1차 확정 KPI 스냅샷 — 생성·목록·diff.
// 백엔드 미배포 시 404 → useAsync error(조용히 폴백, 호출부에서 미표시 처리).

import { apiGetList, apiGet, apiPost } from '@/lib/api';
import type { KpiSnapshotMeta, KpiSnapshotDiff } from '@/lib/types';
import { useAsync } from './useAsync';

// 스냅샷 메타 목록(userId 생략 시 본인 기준). 목록 봉투({data,meta}).
export function useKpiSnapshots(
  cycleId: string | null | undefined,
  params: { userId?: string } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<KpiSnapshotMeta>(`/cycles/${cycleId}/kpi-snapshots`, {
        userId: params.userId,
      }),
    [cycleId, params.userId],
    { enabled: !!cycleId && (options.enabled ?? true) },
  );
}

// 단건 diff(스냅샷 과거 vs 현재 KPI).
export function useKpiSnapshotDiff(
  cycleId: string | null | undefined,
  snapshotId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGet<KpiSnapshotDiff>(
        `/cycles/${cycleId}/kpi-snapshots/${snapshotId}/diff`,
      ),
    [cycleId, snapshotId],
    {
      enabled: !!cycleId && !!snapshotId && (options.enabled ?? true),
    },
  );
}

export const kpiSnapshotCommands = {
  // Cycle Ops §4: 스냅샷 생성(HR). 응답 { label, count }.
  create: (cycleId: string, label: string, userIds?: string[]) =>
    apiPost<{ label: string; count: number }>(
      `/cycles/${cycleId}/kpi-snapshots`,
      { label, ...(userIds ? { userIds } : {}) },
    ),
};
