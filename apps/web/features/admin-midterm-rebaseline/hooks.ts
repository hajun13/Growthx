'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchRebaselineRequests,
  fetchRebaselineRequest,
  fetchRebaselineHistory,
  createRebaselineRequest,
  updateRebaselineRequest,
  reviewRebaselineRequest,
  type RebaselineRequestView,
  type RebaselineRequestDetail,
  type RebaselineHistoryEntry,
} from './api';
import type {
  MidtermControllerListRebaselineRequestsParams,
  MidtermControllerRebaselineHistoryParams,
} from '@growthx/contracts';

/** 재조정 요청 목록 로드. 생성 클라이언트(@growthx/contracts) 기반. */
export function useRebaselineRequestsData(
  params: MidtermControllerListRebaselineRequestsParams | null,
  enabled = true,
) {
  const [items, setItems] = useState<RebaselineRequestView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const key = params ? JSON.stringify(params) : null;

  const reload = useCallback(async () => {
    if (!enabled || !params) return;
    setLoading(true);
    setError(null);
    try {
      const { items: rows, total: t } = await fetchRebaselineRequests(params);
      setItems(rows);
      setTotal(t);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
    // params 는 key 로 안정화 (아래 eslint-disable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, total, loading, error, reload };
}

/** 재조정 요청 상세 로드. */
export function useRebaselineRequestDetail(id: string | null, enabled = true) {
  const [detail, setDetail] = useState<RebaselineRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!enabled || !id) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchRebaselineRequest(id));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [enabled, id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { detail, loading, error, reload };
}

/** 승인된 재조정 변경 이력 로드. */
export function useRebaselineHistoryData(
  params: MidtermControllerRebaselineHistoryParams | null,
  enabled = true,
) {
  const [entries, setEntries] = useState<RebaselineHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const key = params ? JSON.stringify(params) : null;

  const reload = useCallback(async () => {
    if (!enabled || !params) return;
    setLoading(true);
    setError(null);
    try {
      setEntries(await fetchRebaselineHistory(params));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { entries, loading, error, reload };
}

/** 변이 커맨드(생성·수정·검토) — 컴포넌트에서 await 후 reload. */
export const rebaselineCommands = {
  create: createRebaselineRequest,
  update: updateRebaselineRequest,
  review: reviewRebaselineRequest,
};
