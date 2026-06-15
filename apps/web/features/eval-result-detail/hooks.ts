'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchResultDetail, type EvaluationResultDetail } from './api';

/**
 * 평가 상세결과 로드. 생성 클라이언트(@growthx/contracts) 기반.
 * userId·cycleId 둘 다 있어야 호출(둘 중 하나라도 null 이면 비활성 — mid_review 게이팅 등).
 * 반환 shape 은 기존 useResultDetail 과 동일(data·loading·error·reload).
 */
export function useResultDetailData(
  userId: string | null,
  cycleId: string | null,
) {
  const [data, setData] = useState<EvaluationResultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const enabled = !!userId && !!cycleId;

  const reload = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await fetchResultDetail(userId!, cycleId!));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [enabled, userId, cycleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
