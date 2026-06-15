'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchKpis, fetchKpiReviews } from './api';
import type { Kpi, KpiReview } from '@/lib/types';

/** 검토 대상 KPI 목록 로드. 생성 클라이언트(@growthx/contracts) 기반. */
export function useKpiReviewData(
  cycleId: string | undefined,
  enabled: boolean,
) {
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [reviews, setReviews] = useState<KpiReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!enabled || !cycleId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [k, r] = await Promise.all([
        fetchKpis({ cycleId }),
        fetchKpiReviews({ cycleId }),
      ]);
      setKpis(k);
      setReviews(r);
      setLoaded(true);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [enabled, cycleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { kpis, reviews, loading, loaded, error, reload };
}
