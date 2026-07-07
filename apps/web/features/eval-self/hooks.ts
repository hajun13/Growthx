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
  const [nonce, setNonce] = useState(0);

  // fn 은 deps 로 안정화(공용 useAsync 와 동일 규약 — 호출부가 deps 에 의존값 전달).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFn = useCallback(fn, [enabled, ...deps]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    // 취소 가드(공용 useAsync 패턴): deps(주기·평가 id 등) 변경·언마운트 시
    // 늦게 도착한 이전 요청 결과가 최신 데이터를 덮어쓰지 않도록 폐기.
    let cancelled = false;
    setLoading(true);
    setError(null);
    stableFn()
      .then((v) => {
        if (cancelled) return;
        setData(v);
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
  }, [stableFn, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

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
