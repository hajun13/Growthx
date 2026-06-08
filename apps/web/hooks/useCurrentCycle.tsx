'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useCycles } from './useCycles';
import type { ApiError } from '@/lib/api';
import type { EvaluationCycle } from '@/lib/types';

// 선택 주기를 브라우저에 영속화하는 키(새로고침·재방문에도 유지).
const STORAGE_KEY = 'eval.selectedCycleId';

interface CurrentCycleValue {
  cycles: EvaluationCycle[];
  current: EvaluationCycle | null;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

const CurrentCycleContext = createContext<CurrentCycleValue | null>(null);

/**
 * 선택된 평가 주기를 앱 전역에서 공유한다(+ localStorage 영속).
 * 한 화면(예: 평가 운영)에서 주기를 바꾸면 대시보드·평가·KPI 등 모든 페이지가
 * 같은 주기 데이터로 동작한다. (main) 레이아웃에서 한 번만 마운트.
 */
export function CurrentCycleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, loading, error, reload } = useCycles();
  const cycles = useMemo<EvaluationCycle[]>(() => data?.data ?? [], [data]);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);

  // 최초 마운트 시 localStorage 복원(클라이언트에서만 — SSR 안전).
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setSelectedIdState(saved);
  }, []);

  function setSelectedId(id: string | null) {
    setSelectedIdState(id);
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  }

  // 선택값이 현재 목록에 있으면 그것, 없으면(삭제 등) 활성→중간/조정→첫 항목 순 폴백.
  const current = useMemo<EvaluationCycle | null>(() => {
    const picked = selectedId
      ? cycles.find((c) => c.id === selectedId) ?? null
      : null;
    if (picked) return picked;
    return (
      cycles.find((c) => c.status === 'active') ??
      cycles.find(
        (c) => c.status === 'mid_review' || c.status === 'calibration',
      ) ??
      cycles[0] ??
      null
    );
  }, [cycles, selectedId]);

  const value: CurrentCycleValue = {
    cycles,
    current,
    // 기존 계약 유지: selectedId 는 실제 표시 중인 current 의 id.
    selectedId: current?.id ?? null,
    setSelectedId,
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

// 활성 주기를 기본 선택. 전역 Provider 값을 그대로 소비(시그니처 불변).
export function useCurrentCycle(): CurrentCycleValue {
  const ctx = useContext(CurrentCycleContext);
  if (!ctx) {
    throw new Error(
      'useCurrentCycle 은 CurrentCycleProvider 안에서만 사용할 수 있어요.',
    );
  }
  return ctx;
}
