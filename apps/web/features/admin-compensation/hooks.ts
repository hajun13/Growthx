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

  const reload = useCallback(async () => {
    if (!enabled || !cycleId) {
      setLoading(false);
      return;
    }
    const cached = CACHE.get(cycleId);
    if (cached) setRows(cached);
    setLoading(!cached);
    setError(null);
    try {
      const next = await fetchTeamCompensationSimulation(cycleId);
      CACHE.set(cycleId, next);
      setRows(next);
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
