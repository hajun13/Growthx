'use client';

import { apiGetList, apiPost, apiPatch, apiDelete } from '@/lib/api';
import type { Department, DepartmentType } from '@/lib/types';
import { useAsync } from './useAsync';

export function useDepartments(
  params: { type?: DepartmentType; tree?: boolean } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<Department>('/departments', {
        type: params.type,
        tree: params.tree,
      }),
    [params.type, params.tree],
    options,
  );
}

// ── 명령(쓰기, hr_admin) — 봉투 unwrap 후 단건 반환 ──────────────
// 계약: POST /departments, PATCH /departments/:id, DELETE /departments/:id
export const departmentCommands = {
  create: (body: { name: string; type: DepartmentType; parentId?: string }) =>
    apiPost<Department>('/departments', body),
  rename: (id: string, name: string) =>
    apiPatch<Department>(`/departments/${id}`, { name }),
  // 삭제 성공 시 { id } 반환(하위/구성원 있으면 CONFLICT throw).
  remove: (id: string) => apiDelete<{ id: string }>(`/departments/${id}`),
};
