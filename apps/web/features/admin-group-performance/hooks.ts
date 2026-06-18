'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchGroupPerformance,
  upsertGroupPerformance,
  type GroupPerformance,
} from './api';

/**
 * 그룹 실적 로드 + upsert 커맨드. 생성 클라이언트(@growthx/contracts) 기반.
 * groupId가 있으면 단일 그룹, 없으면 사이클 전체 그룹 실적을 반환한다.
 */
export function useGroupPerformanceData(
  params: { cycleId?: string; groupId?: string },
  enabled: boolean,
) {
  const { cycleId, groupId } = params;
  const [items, setItems] = useState<GroupPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchGroupPerformance({ cycleId, groupId }));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [enabled, cycleId, groupId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    perf: items[0] ?? null,
    items,
    loading,
    error,
    reload,
    upsert: upsertGroupPerformance,
  };
}
