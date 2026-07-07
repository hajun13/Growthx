import type { KpiGroup, KpiCategory } from '@/lib/types';

export interface GradingDraft {
  S: string;
  A: string;
  B: string;
  C: string;
  D: string;
}

export interface DraftKpi {
  id?: string;
  /** 서버 반려 사유 — 반려된 KPI 는 status='draft' + rejectReason 으로 되돌아온다(표시 전용). */
  rejectReason?: string | null;
  group: KpiGroup;
  category: KpiCategory;
  coreStrategy: string;
  csf: string;
  title: string;
  targetText: string;
  measureMethod: string;
  weight: string;
  isQualitative: boolean;
  gradingCriteria: GradingDraft;
}
