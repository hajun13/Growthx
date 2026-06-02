import { Grade, GroupTier, MeasureType } from '@prisma/client';

/** RuleSet JSON 필드 타입 (계약 §6 RuleSet 객체와 1:1). */

export interface GradeScaleBand {
  grade: Grade;
  min: number;
  max: number;
}

/** 달성률(%) → 등급 밴드. amount/rate 측정방식용. */
export interface RateGradeBand {
  grade: Grade;
  minRate: number;
  maxRate: number | null; // null = 상한 없음
}

/** 건수 → 등급 밴드. count 측정방식의 KPI별 임계값(Kpi.grading)용. */
export interface CountGradeBand {
  grade: Grade;
  minCount: number;
  maxCount: number | null; // null = 상한 없음
}

/**
 * 측정방식별 달성률→등급 표 (business-rules §2).
 * amount/rate 는 RuleSet 에서, count 는 KPI별 grading(CountGradeBand[]) 에서 읽는다.
 * qualitative 는 평가자가 직접 등급 부여.
 */
export interface GradingScales {
  amount: RateGradeBand[];
  rate: RateGradeBand[];
}

export type PoolRow = Record<Grade, number>;

export interface PoolRatios {
  excellent: PoolRow;
  standard: PoolRow;
  poor: PoolRow;
}

export type RaiseRates = Record<Grade, number>;

export interface WeightPolicy {
  totalMustEqual: number; // 100
  qualitativeMaxPercent: number; // 30
}

export interface ParsedRuleSet {
  gradeScale: GradeScaleBand[];
  gradingScales: GradingScales;
  poolRatios: PoolRatios;
  raiseRates: RaiseRates;
  weightPolicy: WeightPolicy;
}

export type { GroupTier, MeasureType };
