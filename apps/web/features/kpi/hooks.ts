'use client';

import { useCallback, useEffect, useState } from 'react';
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
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    // 취소 가드(공용 useAsync 패턴): cycleId/userId 변경·언마운트 시 이전 in-flight
    // 요청 결과를 폐기해 늦게 도착한 stale 응답이 최신 데이터를 덮어쓰지 않게 한다.
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchKpis(cycleId!, userId!)
      .then((rows) => {
        if (cancelled) return;
        setData({ data: rows });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, cycleId, userId, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload };
}
