'use client';

import { apiGetList } from '@/lib/api';
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
