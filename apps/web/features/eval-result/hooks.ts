'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchResults, type EvaluationResult } from './api';

/** 평가결과 목록 로드. 생성 클라이언트(@growthx/contracts) 기반. */
export function useResultsData(
  params: { cycleId?: string; userId?: string },
  enabled: boolean,
) {
  const [items, setItems] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const seqRef = useRef(0);

  const { cycleId, userId } = params;

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const seq = ++seqRef.current; // 늦게 도착한 이전 응답이 최신을 덮지 않도록
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchResults({ cycleId, userId });
      if (seq === seqRef.current) setItems(rows);
    } catch (e) {
      if (seq === seqRef.current) setError(e);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [enabled, cycleId, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, loading, error, reload };
}
