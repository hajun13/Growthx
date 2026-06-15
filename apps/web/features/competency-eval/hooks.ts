'use client';

// 역량평가(임직원 응답) 데이터 훅 — 생성 클라이언트(@growthx/contracts) 기반.
// 문항 조회 + 본인 응답 조회 + 일괄 저장/제출 커맨드. 봉투 unwrap 은 api.ts 가 처리.
// 역량평가는 참고용(연봉·등급 미반영).

import { useCallback, useEffect, useState } from 'react';
import {
  fetchCompetencyQuestions,
  fetchCompetencyResponses,
  bulkSaveCompetencyResponses,
  bulkSubmitCompetencyResponses,
  type CompetencyQuestion,
  type CompetencyResponse,
  type CompetencyResponseItem,
} from './api';

interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: unknown;
  reload: () => Promise<void>;
}

/** 주기별 역량평가 문항 목록. cycleId 없으면 비활성. targetGroup 필터 선택적. */
export function useCompetencyQuestions(
  cycleId: string | null | undefined,
  options: { enabled?: boolean; targetGroup?: string } = {},
): AsyncState<CompetencyQuestion[]> {
  const { enabled: enabledOpt, targetGroup } = options;
  const enabled = !!cycleId && (enabledOpt ?? true);
  const [data, setData] = useState<CompetencyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!enabled || !cycleId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCompetencyQuestions(cycleId, targetGroup));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cycleId, targetGroup]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

/** 본인(또는 대상자) 응답 목록. cycleId·userId 필수. */
export function useCompetencyResponses(
  params: { cycleId?: string; userId?: string } = {},
  options: { enabled?: boolean } = {},
): AsyncState<CompetencyResponse[]> {
  const { cycleId, userId } = params;
  const enabled = !!cycleId && !!userId && (options.enabled ?? true);
  const [data, setData] = useState<CompetencyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!enabled || !cycleId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCompetencyResponses({ cycleId, userId }));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [enabled, cycleId, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

/** 일괄 저장/제출 커맨드(임시저장·최종제출). */
export const competencyResponseCommands = {
  bulkSave: (cycleId: string, responses: CompetencyResponseItem[]) =>
    bulkSaveCompetencyResponses(cycleId, responses),
  bulkSubmit: (cycleId: string, responses: CompetencyResponseItem[]) =>
    bulkSubmitCompetencyResponses(cycleId, responses),
};
