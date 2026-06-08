'use client';

import { apiGetList, apiPost, apiPatch, apiDelete } from '@/lib/api';
import type {
  User,
  Role,
  CreateUserRequest,
  UpdateUserRequest,
} from '@/lib/types';
import { useAsync } from './useAsync';

export function useUsers(
  params: {
    role?: Role;
    departmentId?: string;
    q?: string;
    includeInactive?: boolean;
    pageSize?: number;
  } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<User>('/users', {
        role: params.role,
        departmentId: params.departmentId,
        q: params.q,
        // 조직도는 비활성 포함 표시(카드에서 흐림 처리).
        includeInactive: params.includeInactive ? 'true' : undefined,
        pageSize: params.pageSize,
      }),
    [
      params.role,
      params.departmentId,
      params.q,
      params.includeInactive,
      params.pageSize,
    ],
    options,
  );
}

// ── 명령(쓰기, hr_admin) — 봉투 unwrap 후 반환 ──────────────
// 라이프사이클(contract-userlifecycle.md): resign·reactivate·remove(하드)·purge(완전).
export const userCommands = {
  create: (body: CreateUserRequest) => apiPost<User>('/users', body),
  update: (id: string, body: UpdateUserRequest) =>
    apiPatch<User>(`/users/${id}`, body),
  // 퇴사: employmentStatus=resigned, resignedAt=now, isActive=false (멱등). → User.
  resign: (id: string) => apiPatch<User>(`/users/${id}/resign`),
  // 복직: active, isActive=true, resignedAt=null. → User.
  reactivate: (id: string) => apiPatch<User>(`/users/${id}/reactivate`),
  // 하드 삭제(기본). 활성/이력 있으면 409 throw. 성공 → { id }.
  remove: (id: string) => apiDelete<{ id: string }>(`/users/${id}`),
  // 완전 삭제(이력 포함 cascade). 성공 → { id, purged:true }.
  purge: (id: string) =>
    apiDelete<{ id: string; purged: boolean }>(`/users/${id}`, {
      force: 'true',
    }),
};
