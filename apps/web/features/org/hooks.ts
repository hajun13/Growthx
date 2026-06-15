'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrgChartNode } from '@/lib/types';
import { fetchOrgChart } from './api';

/** 조직도 트리 로드 + reload. 생성 클라이언트(@growthx/contracts) 기반. */
export function useOrgChartData(enabled: boolean) {
  const [data, setData] = useState<OrgChartNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchOrgChart());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
