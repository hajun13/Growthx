'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchKpis, fetchKpiReviews, fetchApprovalChain } from './api';
import type { Kpi, KpiApprovalStage, KpiReview } from '@/lib/types';

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

/** 선택된 피평가자의 순차 결재선 로드. userId 변경 시 재조회, 언마운트/전환 가드. */
export function useApprovalChain(userId: string | null) {
  const [stages, setStages] = useState<KpiApprovalStage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setStages([]);
      return;
    }
    setLoading(true);
    fetchApprovalChain(userId)
      .then((s) => { if (!cancelled) setStages(s); })
      .catch(() => { if (!cancelled) setStages([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  return { stages, loading };
}
