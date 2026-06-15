'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchCompetencyCategories,
  createCompetencyCategory,
  updateCompetencyCategory,
  removeCompetencyCategory,
  copyQuestionsFromCycle,
  fetchCompetencyQuestions,
  createCompetencyQuestion,
  updateCompetencyQuestion,
  removeCompetencyQuestion,
  type CompetencyQuestion,
  type CompetencyCategory,
} from './api';

/** 카테고리 목록 훅 */
export function useCompetencyCategoriesData(options: { enabled?: boolean } = {}) {
  const active = options.enabled ?? true;
  const [items, setItems] = useState<CompetencyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchCompetencyCategories());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => { void reload(); }, [reload]);

  return { items, loading, error, reload };
}

/** 문항 목록 훅 */
export function useCompetencyQuestionsData(
  params: { cycleId?: string; targetGroup?: string } = {},
  options: { enabled?: boolean } = {},
) {
  const active = options.enabled ?? true;
  const [items, setItems] = useState<CompetencyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchCompetencyQuestions(params));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, params.cycleId, params.targetGroup]);

  useEffect(() => { void reload(); }, [reload]);

  return { items, loading, error, reload };
}

export const competencyQuestionCommands = {
  create: createCompetencyQuestion,
  update: updateCompetencyQuestion,
  remove: removeCompetencyQuestion,
};

export const competencyCategoryCommands = {
  create: createCompetencyCategory,
  update: updateCompetencyCategory,
  remove: removeCompetencyCategory,
  copyFromCycle: copyQuestionsFromCycle,
};
