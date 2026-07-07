'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { useCycles } from './useCycles';
import type { ApiError } from '@/lib/api';
import type { EvaluationCycle } from '@/lib/types';

// 과거 전역 선택 영속 키 — 폐기. 사용자 구분 없는 localStorage 공유라 같은 브라우저의
// 다른 계정에도 선택이 번지고(A 가 바꾸면 B 도 바뀜), 13개 화면이 한 상태를 공유해
// "어디서 바꿨는지 모르는" 혼란을 만들었다. 이제 작업 화면은 진행 주기 고정,
// 조회·관리 화면은 URL 쿼리(useCycleParam) 기반 페이지-로컬 선택을 쓴다.
const LEGACY_STORAGE_KEY = 'eval.selectedCycleId';

interface CurrentCycleValue {
  cycles: EvaluationCycle[];
  /** 진행 중인 주기(작업 기준) — active → mid_review/calibration → 첫 항목 폴백. */
  current: EvaluationCycle | null;
  /** 기존 계약 유지: 표시 중인 current 의 id. (전역 선택 기능은 제거됨) */
  selectedId: string | null;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

const CurrentCycleContext = createContext<CurrentCycleValue | null>(null);

/**
 * 진행 중인 평가 주기를 앱 전역에서 공유한다(읽기 전용).
 * 작업 화면(KPI 작성·본인평가·부서장 평가·중간점검)은 항상 이 주기로 고정된다 —
 * 과거 주기는 마감되어 쓰기가 불가능하므로 주기 전환이 무의미하다.
 * 연도 전환이 필요한 조회·관리 화면은 useCycleParam(URL 쿼리 기반)을 사용한다.
 */
export function CurrentCycleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, loading, error, reload } = useCycles();
  const cycles = useMemo<EvaluationCycle[]>(() => data?.data ?? [], [data]);

  // 폐기된 전역 선택 키 정리(계정 간 공유 잔재 제거).
  useEffect(() => {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, []);

  // 진행 주기: active → 중간/조정 → 첫 항목 순 폴백.
  const current = useMemo<EvaluationCycle | null>(() => {
    return (
      cycles.find((c) => c.status === 'active') ??
      cycles.find(
        (c) => c.status === 'mid_review' || c.status === 'calibration',
      ) ??
      cycles[0] ??
      null
    );
  }, [cycles]);

  const value: CurrentCycleValue = {
    cycles,
    current,
    selectedId: current?.id ?? null,
    loading,
    error,
    reload,
  };

  return (
    <CurrentCycleContext.Provider value={value}>
      {children}
    </CurrentCycleContext.Provider>
  );
}

// 진행 주기를 소비(읽기 전용). 전역 Provider 값을 그대로 반환.
export function useCurrentCycle(): CurrentCycleValue {
  const ctx = useContext(CurrentCycleContext);
  if (!ctx) {
    throw new Error(
      'useCurrentCycle 은 CurrentCycleProvider 안에서만 사용할 수 있어요.',
    );
  }
  return ctx;
}
