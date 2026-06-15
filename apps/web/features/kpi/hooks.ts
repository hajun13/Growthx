'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Kpi } from '@/lib/types';
import { fetchKpis } from './api';

/**
 * KPI 작성 화면 데이터 훅 — 생성 클라이언트(@growthx/contracts) 기반.
 * 기존 useKpis(useAsync) 와 동일하게 목록 봉투 형태 { data: { data: Kpi[] } } 와
 * { loading, error, reload } 를 제공해 화면 로직(`data?.data`)을 그대로 보존한다.
 */

interface KpisState {
  data: { data: Kpi[] } | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
}

export function useKpisData(
  cycleId: string | undefined,
  userId: string | undefined,
): KpisState {
  const enabled = !!cycleId && !!userId;
  const [data, setData] = useState<{ data: Kpi[] } | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<unknown>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchKpis(cycleId!, userId!)
      .then((rows) => {
        if (!mounted.current) return;
        setData({ data: rows });
      })
      .catch((e) => {
        if (!mounted.current) return;
        setError(e);
      })
      .finally(() => {
        if (!mounted.current) return;
        setLoading(false);
      });
  }, [enabled, cycleId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
