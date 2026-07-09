'use client';

// 역량평가(임직원 응답) 데이터 훅 — 생성 클라이언트(@growthx/contracts) 기반.
// 문항 조회 + 본인 응답 조회 + 일괄 저장/제출 커맨드. 봉투 unwrap 은 api.ts 가 처리.
// 역량평가는 참고용(연봉·등급 미반영).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchCompetencyQuestions,
  fetchCompetencyResponses,
  fetchCompetencySheet,
  fetchCompetencyTargets,
  bulkSaveCompetencyResponses,
  bulkSubmitCompetencyResponses,
  saveCompetencyOpinion,
  type CompetencyQuestion,
  type CompetencyResponse,
  type CompetencyResponseItem,
  type CompetencySheet,
  type CompetencyTarget,
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
  const seqRef = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled || !cycleId) {
      setLoading(false); // 비활성이면 무한 스켈레톤 방지
      return;
    }
    const seq = ++seqRef.current; // 늦게 도착한 이전 응답이 최신을 덮지 않도록
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCompetencyQuestions(cycleId, targetGroup);
      if (seq === seqRef.current) setData(rows);
    } catch (e) {
      if (seq === seqRef.current) setError(e);
    } finally {
      if (seq === seqRef.current) setLoading(false);
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
  const seqRef = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled || !cycleId) {
      setLoading(false); // 비활성이면 무한 스켈레톤 방지
      return;
    }
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCompetencyResponses({ cycleId, userId });
      if (seq === seqRef.current) setData(rows);
    } catch (e) {
      if (seq === seqRef.current) setError(e);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [enabled, cycleId, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

/** 역량평가서(시트) — 대상자 기준 문항+응답+의견+평가선+환산 일체. */
export function useCompetencySheet(
  params: { cycleId?: string; userId?: string },
  options: { enabled?: boolean } = {},
): AsyncState<CompetencySheet | null> {
  const { cycleId, userId } = params;
  const enabled = !!cycleId && (options.enabled ?? true);
  const [data, setData] = useState<CompetencySheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const seqRef = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled || !cycleId) {
      setLoading(false);
      return;
    }
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    try {
      const sheet = await fetchCompetencySheet({ cycleId, userId });
      if (seq === seqRef.current) setData(sheet);
    } catch (e) {
      if (seq === seqRef.current) setError(e);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [enabled, cycleId, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

/** 내가 평가자로 배정된 역량평가 대상 목록. */
export function useCompetencyTargets(
  cycleId: string | null | undefined,
  options: { enabled?: boolean } = {},
): AsyncState<CompetencyTarget[]> {
  const enabled = !!cycleId && (options.enabled ?? true);
  const [data, setData] = useState<CompetencyTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const seqRef = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled || !cycleId) {
      setLoading(false);
      return;
    }
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCompetencyTargets(cycleId);
      if (seq === seqRef.current) setData(rows);
    } catch (e) {
      if (seq === seqRef.current) setError(e);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [enabled, cycleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

/** 일괄 저장/제출 + 종합의견 커맨드. targetUserId 지정=평가자 열. */
export const competencyResponseCommands = {
  bulkSave: (cycleId: string, responses: CompetencyResponseItem[], targetUserId?: string) =>
    bulkSaveCompetencyResponses(cycleId, responses, targetUserId),
  bulkSubmit: (cycleId: string, responses: CompetencyResponseItem[], targetUserId?: string) =>
    bulkSubmitCompetencyResponses(cycleId, responses, targetUserId),
  saveOpinion: (cycleId: string, userId: string, comment: string) =>
    saveCompetencyOpinion({ cycleId, userId, comment }),
};
