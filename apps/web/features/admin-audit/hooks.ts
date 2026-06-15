'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAuditLogs,
  type AuditLogFilter,
  type AuditLogPage,
} from './api';

/**
 * 감사 로그 조회(필터 + 페이지네이션). 생성 클라이언트(@growthx/contracts) 기반.
 * 반환: { data: { data, meta }, loading } — 기존 useAuditLogs 와 동일한 형태.
 */
export function useAuditLogsData(
  filter: AuditLogFilter = {},
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<AuditLogPage | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const { actorId, action, entity, entityId, from, to, page, pageSize } = filter;

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(
        await fetchAuditLogs({
          actorId,
          action,
          entity,
          entityId,
          from,
          to,
          page,
          pageSize,
        }),
      );
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, actorId, action, entity, entityId, from, to, page, pageSize]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
