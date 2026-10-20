'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchUnlockOverview, unlockKpis, type UnlockOverview } from './api';

/** 확정 해제 화면 데이터 — cycleId 가 없거나 enabled=false 면 호출하지 않는다. */
export function useUnlockOverview(cycleId: string | undefined, options: { enabled?: boolean } = {}) {
  const enabled = (options.enabled ?? true) && !!cycleId;
  const [data, setData] = useState<UnlockOverview | undefined>(undefined);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!enabled || !cycleId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await fetchUnlockOverview(cycleId));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [enabled, cycleId]);

  useEffect(() => {
    // 주기 전환 시 이전 주기 목록이 남아 선택되지 않도록 비운다.
    setData(undefined);
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export const kpiUnlockCommands = { unlock: unlockKpis };
