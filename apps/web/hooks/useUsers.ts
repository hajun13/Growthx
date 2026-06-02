'use client';

import { apiGetList } from '@/lib/api';
import type { User, Role } from '@/lib/types';
import { useAsync } from './useAsync';

export function useUsers(
  params: { role?: Role; departmentId?: string; q?: string } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<User>('/users', {
        role: params.role,
        departmentId: params.departmentId,
        q: params.q,
      }),
    [params.role, params.departmentId, params.q],
    options,
  );
}
