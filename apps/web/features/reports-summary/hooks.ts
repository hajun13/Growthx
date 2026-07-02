'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchEvaluationSummary, type SummaryRow } from './api';

export type { SummaryRow } from './api';

/** 평가자정리 표 로드. 생성 클라이언트(@growthx/contracts) 기반. */
export function useEvaluationSummaryData(
  cycleId: string | undefined,
  enabled: boolean,
) {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!enabled || !cycleId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchEvaluationSummary(cycleId));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [enabled, cycleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, loading, error, reload };
}
