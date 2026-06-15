'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  EvaluationResult,
  MonthlyPerformanceSummary,
} from '@/lib/types';
import {
  fetchResults,
  fetchMonthlyPerformanceSummary,
} from './api';

/** 분포 모니터링용 결과 목록 로드. 생성 클라이언트(@growthx/contracts) 기반. */
export function useResultsData(cycleId: string | undefined) {
  const [data, setData] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!cycleId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchResults(cycleId));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

/** 월별 실적 누적 요약 로드(부서 단위). 생성 클라이언트 기반. */
export function useMonthlyPerformanceData(
  cycleId: string | undefined,
  departmentId: string | undefined,
) {
  const [data, setData] = useState<MonthlyPerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!cycleId || !departmentId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchMonthlyPerformanceSummary(cycleId, departmentId));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [cycleId, departmentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
