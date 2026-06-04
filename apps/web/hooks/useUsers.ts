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

// ── 명령(쓰기, hr_admin) — 봉투 unwrap 후 User 반환 ──────────────
export const userCommands = {
  create: (body: CreateUserRequest) => apiPost<User>('/users', body),
  update: (id: string, body: UpdateUserRequest) =>
    apiPatch<User>(`/users/${id}`, body),
  // soft delete → isActive=false 된 User 반환.
  deactivate: (id: string) => apiDelete<User>(`/users/${id}`),
};
