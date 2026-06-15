'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  Evaluation,
  EvaluationDetail,
  EvaluationEvidence,
  Kpi,
  RuleSet,
} from '@/lib/types';
import {
  fetchSelfEvaluations,
  fetchEvaluationDetail,
  fetchEvaluationEvidence,
  fetchMyKpis,
  fetchRuleSet,
} from './api';

/**
 * 본인평가 데이터 훅 — 생성 클라이언트(@growthx/contracts) 기반.
 * 기존 useAsync 훅과 동일한 { data, loading, error, reload } 형태를 제공해 화면 로직을 보존한다.
 */

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
}

function useAsyncValue<T>(
  fn: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  enabled: boolean,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    void fn()
      .then((v) => setData(v))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    reload();
  }, [enabled, reload]);

  return { data, loading, error, reload };
}

/** 현재 주기·본인 self 평가 목록. */
export function useSelfEvaluations(
  cycleId: string | undefined,
  evaluateeId: string | undefined,
): AsyncState<Evaluation[]> {
  const enabled = !!cycleId && !!evaluateeId;
  return useAsyncValue(
    () => fetchSelfEvaluations(cycleId!, evaluateeId!),
    [cycleId, evaluateeId],
    enabled,
  );
}

/** 본인평가 상세(kpiScores·comments). */
export function useSelfEvaluationDetail(
  id: string | null,
): AsyncState<EvaluationDetail> {
  return useAsyncValue(
    () => fetchEvaluationDetail(id!),
    [id],
    !!id,
  );
}

/** 평가 문항별 증빙 첨부 목록(메타데이터). */
export function useSelfEvidence(
  id: string | null,
): AsyncState<EvaluationEvidence[]> {
  return useAsyncValue(
    () => fetchEvaluationEvidence(id!),
    [id],
    !!id,
  );
}

/** 본인 KPI 목록(현재 주기). */
export function useMyKpis(
  cycleId: string | undefined,
  userId: string | undefined,
): AsyncState<Kpi[]> {
  const enabled = !!cycleId && !!userId;
  return useAsyncValue(
    () => fetchMyKpis(cycleId!, userId!),
    [cycleId, userId],
    enabled,
  );
}

/** 등급표(RuleSet). */
export function useSelfRuleSet(id: string | null): AsyncState<RuleSet> {
  return useAsyncValue(() => fetchRuleSet(id!), [id], !!id);
}
