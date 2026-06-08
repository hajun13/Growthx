'use client';

// 직급 레지스트리 훅 (contract-positions-org C-2).
// GET /positions → { data: PositionDef[], meta:{ total } } 봉투 unwrap.
// 라벨·정렬·색의 단일 출처. mutation 은 hr_admin.
import { apiGetList, apiPost, apiPatch, apiDelete } from '@/lib/api';
import type {
  PositionDef,
  CreatePositionRequest,
  UpdatePositionRequest,
} from '@/lib/types';
import { useAsync } from './useAsync';

export function usePositions(
  params: { includeInactive?: boolean } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<PositionDef>('/positions', {
        includeInactive: params.includeInactive ? 'true' : undefined,
      }),
    [params.includeInactive],
    options,
  );
}

// ── 명령(쓰기, hr_admin) — 봉투 unwrap 후 PositionDef 반환 ──────────
export const positionCommands = {
  create: (body: CreatePositionRequest) =>
    apiPost<PositionDef>('/positions', body),
  update: (id: string, body: UpdatePositionRequest) =>
    apiPatch<PositionDef>(`/positions/${id}`, body),
  // 삭제 성공 시 { id, deleted } 반환. 시스템/사용중이면 409(FORBIDDEN/IN_USE) throw.
  remove: (id: string) => apiDelete<{ id: string; deleted: boolean }>(`/positions/${id}`),
};
