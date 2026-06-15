'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RuleSet } from '@/lib/types';
import { fetchRuleSet, updateRuleSet } from './api';

/**
 * 단일 RuleSet 로드. 생성 클라이언트(@growthx/contracts) 기반.
 * 기존 useRuleSet(@/hooks/useRuleSets) 와 동일한 { data, loading, error, reload } shape.
 * id 가 null 이면 비활성(로딩 종료·data null).
 */
export function useRuleSetData(id: string | null) {
  const [data, setData] = useState<RuleSet | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await fetchRuleSet(id));
    } catch (e) {
      setError(
        e instanceof Error ? e : new Error('규칙을 불러오지 못했어요.'),
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

/** RuleSet 저장 커맨드(생성 클라이언트). 기존 ruleSetCommands.update 대체. */
export const ruleSetCommands = {
  update: (id: string, body: Partial<RuleSet>) => updateRuleSet(id, body),
};
