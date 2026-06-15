'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAppeals,
  createAppeal,
  respondAppeal,
  decideAppeal,
  type Appeal,
} from './api';

export type { Appeal, AppealStatus } from './api';

/**
 * 이의제기 목록 로드 + 신청/답변/결정 커맨드. 생성 클라이언트(@growthx/contracts) 기반.
 * 기존 useAppeals + appealCommands 를 슬라이스 로컬 훅으로 대체(데이터 소스만 이관).
 */
export function useAppealsData(enabled: boolean) {
  const [items, setItems] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchAppeals());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    items,
    loading,
    error,
    reload,
    create: createAppeal,
    respond: respondAppeal,
    decide: decideAppeal,
  };
}
