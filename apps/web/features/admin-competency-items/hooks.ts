'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchCompetencyQuestions,
  createCompetencyQuestion,
  updateCompetencyQuestion,
  removeCompetencyQuestion,
  type CompetencyQuestion,
} from './api';

/**
 * 역량평가 문항 목록 로드 + CRUD 커맨드. 생성 클라이언트(@growthx/contracts) 기반.
 * cycleId 없거나 enabled=false 면 호출하지 않는다(기존 useCompetencyQuestions 의미 보존).
 */
export function useCompetencyQuestionsData(
  cycleId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  const active = !!cycleId && (options.enabled ?? true);
  const [items, setItems] = useState<CompetencyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!active || !cycleId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchCompetencyQuestions(cycleId));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [active, cycleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, loading, error, reload };
}

export const competencyQuestionCommands = {
  create: createCompetencyQuestion,
  update: updateCompetencyQuestion,
  remove: removeCompetencyQuestion,
};
