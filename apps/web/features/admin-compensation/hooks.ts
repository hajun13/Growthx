'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchTeamCompensationSimulation,
  type CompensationSimulation,
} from './api';

/** 팀 전체 보상 시뮬레이션 로드. 생성 클라이언트(@growthx/contracts) 기반. */
export function useTeamCompensationSimulationData(
  cycleId: string | undefined,
  enabled: boolean,
) {
  const [rows, setRows] = useState<CompensationSimulation[]>([]);
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
      setRows(await fetchTeamCompensationSimulation(cycleId));
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
