'use client';

import { apiGet, apiGetList, apiPatch } from '@/lib/api';
import type { RuleSet } from '@/lib/types';
import { useAsync } from './useAsync';

export function useRuleSets(options: { enabled?: boolean } = {}) {
  return useAsync(() => apiGetList<RuleSet>('/rule-sets'), [], options);
}

export function useRuleSet(id: string | null) {
  return useAsync(() => apiGet<RuleSet>(`/rule-sets/${id}`), [id], {
    enabled: !!id,
  });
}

export const ruleSetCommands = {
  update: (id: string, body: Partial<RuleSet>) =>
    apiPatch<RuleSet>(`/rule-sets/${id}`, body),
};
