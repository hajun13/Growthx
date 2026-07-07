'use client';

// 조회·관리 화면 전용 주기 선택 — URL 쿼리(?cycleId=) 기반 페이지-로컬.
// 전역 상태·localStorage 를 쓰지 않아 ①바꾼 페이지만 바뀌고 ②같은 브라우저의
// 다른 계정으로 번지지 않으며 ③새로고침·링크 공유에도 선택이 유지된다.
// 반환 형태는 useCurrentCycle + setSelectedId 로, 기존 셀렉터 화면의 드롭인 대체.
// 주의: useSearchParams 를 쓰므로 소비 컴포넌트는 <Suspense> 경계 안에서 렌더해야
// 한다(ResultDetailView 패턴 — 정적 빌드 시 CSR bailout 에러 방지).

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCurrentCycle } from './useCurrentCycle';
import type { ApiError } from '@/lib/api';
import type { EvaluationCycle } from '@/lib/types';

export interface CycleParamValue {
  cycles: EvaluationCycle[];
  /** URL 의 ?cycleId= 가 유효하면 그 주기, 없으면 진행 주기 폴백. */
  current: EvaluationCycle | null;
  selectedId: string | null;
  /** 선택 변경 — URL 쿼리를 교체(replace, 스크롤 유지). null 이면 파라미터 제거(진행 주기 복귀). */
  setSelectedId: (id: string | null) => void;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

export function useCycleParam(): CycleParamValue {
  const { cycles, current: ongoing, loading, error, reload } = useCurrentCycle();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const param = searchParams.get('cycleId');

  const current = useMemo<EvaluationCycle | null>(() => {
    const picked = param ? cycles.find((c) => c.id === param) ?? null : null;
    return picked ?? ongoing;
  }, [param, cycles, ongoing]);

  const setSelectedId = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (id) next.set('cycleId', id);
      else next.delete('cycleId');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

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
