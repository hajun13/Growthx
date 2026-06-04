'use client';

import { apiGetList } from '@/lib/api';
import type { AuditLog } from '@/lib/types';
import { useAsync } from './useAsync';

export interface AuditLogFilter {
  actorId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

// M2-C4: 감사 로그 조회(필터 + 페이지네이션). { data, meta }.
export function useAuditLogs(
  filter: AuditLogFilter = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<AuditLog>('/audit-logs', {
        actorId: filter.actorId,
        action: filter.action,
        entity: filter.entity,
        entityId: filter.entityId,
        from: filter.from,
        to: filter.to,
        page: filter.page,
        pageSize: filter.pageSize,
      }),
    [
      filter.actorId,
      filter.action,
      filter.entity,
      filter.entityId,
      filter.from,
      filter.to,
      filter.page,
      filter.pageSize,
    ],
    options,
  );
}
