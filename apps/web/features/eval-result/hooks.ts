'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchResults, type EvaluationResult } from './api';

/** 평가결과 목록 로드. 생성 클라이언트(@growthx/contracts) 기반. */
export function useResultsData(
  params: { cycleId?: string; userId?: string },
  enabled: boolean,
) {
  const [items, setItems] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const { cycleId, userId } = params;

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchResults({ cycleId, userId }));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [enabled, cycleId, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, loading, error, reload };
}
