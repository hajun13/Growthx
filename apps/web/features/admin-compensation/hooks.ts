'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchTeamCompensationSimulation,
  type CompensationSimulation,
} from './api';

const CACHE = new Map<string, CompensationSimulation[]>();

/** 팀 전체 보상 시뮬레이션 로드. 생성 클라이언트(@growthx/contracts) 기반. */
export function useTeamCompensationSimulationData(
  cycleId: string | undefined,
  enabled: boolean,
) {
  const [rows, setRows] = useState<CompensationSimulation[]>(
    cycleId ? CACHE.get(cycleId) ?? [] : [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled || !cycleId) {
      setLoading(false);
      return;
    }
    // 취소 가드(공용 useAsync 패턴): cycleId 전환·언마운트 시 이전 in-flight 응답을
    // 폐기해 이전 주기 데이터가 새 주기 화면을 덮어쓰는(→ blur 저장 시 오염) 경쟁조건 차단.
    let cancelled = false;
    const cached = CACHE.get(cycleId);
    // 즉시 클리어: 캐시가 없으면 이전 주기 행을 비워 stale 표시·저장을 방지.
    setRows(cached ?? []);
    setLoading(!cached);
    setError(null);
    fetchTeamCompensationSimulation(cycleId)
      .then((next) => {
        CACHE.set(cycleId, next); // 캐시는 cycleId 키라 취소돼도 갱신해 둔다.
        if (cancelled) return;
        setRows(next);
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
  }, [enabled, cycleId, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { rows, loading, error, reload };
}
