import type { KpiGroup, KpiCategory, MeasureType } from '@/lib/types';

export interface GradingDraft {
  S: string;
  A: string;
  B: string;
  C: string;
  D: string;
}

export interface DraftKpi {
  id?: string;
  group: KpiGroup;
  category: KpiCategory;
  measureType: MeasureType;
  coreStrategy: string;
  csf: string;
  title: string;
  targetText: string;
  measureMethod: string;
  targetValue: string;
  weight: string;
  isQualitative: boolean;
  useAbsoluteAmount: boolean;
  gradingCriteria: GradingDraft;
}
