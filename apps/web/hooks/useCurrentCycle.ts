'use client';

import { useMemo, useState } from 'react';
import { useCycles } from './useCycles';
import type { EvaluationCycle } from '@/lib/types';

// 활성 주기를 기본 선택. 사용자가 셀렉트로 변경 가능.
export function useCurrentCycle() {
  const { data, loading, error, reload } = useCycles();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cycles: EvaluationCycle[] = data?.data ?? [];

  const current = useMemo(() => {
    if (selectedId) {
      return cycles.find((c) => c.id === selectedId) ?? null;
    }
    // 활성 우선, 없으면 mid_review/calibration, 그래도 없으면 첫 항목.
    return (
      cycles.find((c) => c.status === 'active') ??
      cycles.find(
        (c) => c.status === 'mid_review' || c.status === 'calibration',
      ) ??
      cycles[0] ??
      null
    );
  }, [cycles, selectedId]);

  return {
    cycles,
    current,
    selectedId: current?.id ?? null,
    setSelectedId,
    loading,
    error,
    reload,
  };
}
