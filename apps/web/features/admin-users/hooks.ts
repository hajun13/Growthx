'use client';

/**
 * admin-users feature — 데이터 훅.
 * 기존 useUsers 와 동일한 표면({ data, loading, error, reload })을 유지하되,
 * 데이터 소스만 생성 클라이언트(@growthx/contracts) 기반 api.ts 로 교체.
 * useAsync 로 봉투-unwrap 된 { data: User[] } 를 그대로 보관한다(뷰는 usersData.data 사용).
 */
import { useAsync } from '@/hooks/useAsync';
import type { User } from '@/lib/types';
import { fetchUsers, type UserListParams } from './api';

export function useUsers(
  params: UserListParams = {},
  options: { enabled?: boolean } = {},
) {
  // meta.total 보존 — pageSize 하드캡으로 잘린 목록을 화면이 알아챌 수 있게.
  return useAsync<{ data: User[]; meta?: { total?: number } }>(
    () =>
      fetchUsers({
        departmentId: params.departmentId,
        q: params.q,
        includeInactive: params.includeInactive,
        pageSize: params.pageSize,
      }),
    [
      params.departmentId,
      params.q,
      params.includeInactive,
      params.pageSize,
    ],
    options,
  );
}
