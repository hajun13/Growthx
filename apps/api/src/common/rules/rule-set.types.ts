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
  /**
   * KpiGroup 별 가중치 합 강제(설정 가능). 키 = KpiGroup enum 값.
   * 2026 기본: performance_core 80 + collaboration_growth 20.
   * 미설정 시 ScoringService 가 80/20 기본을 사용.
   */
  kpiGroupWeights?: Partial<Record<'performance_core' | 'collaboration_growth', number>>;
  /**
   * 제출 검증 게이트(설정 가능, 기본 비차단). 2026-06-08 제품 결정:
   * KPI 를 전부 서술형(qualitative)으로 전환하며 아래 검사를 면제한다.
   * 필요 시 RuleSet 편집으로 true 로 켜면 다시 차단된다.
   * - enforceQualitativeCap: 정성 비중 ≤ qualitativeMaxPercent 상한 강제 여부.
   * - enforceGroupRatio: KpiGroup 비율(성과중심/협업·성장) 강제 여부.
   * (가중치 합=100 검증은 이 플래그와 무관하게 항상 강제된다.)
   */
  enforceQualitativeCap?: boolean;
  enforceGroupRatio?: boolean;
  /**
   * 그룹 실적 tier별 보상 인상률 보너스(%, 설정 가능). 인상률에 가산(음수 허용).
   * 2026 기본: { excellent: 2, standard: 0, poor: -1 }.
   * GroupPerformance.tier(GroupTier)에 매핑되며 compute·시뮬레이션에서 raiseRate에 합산.
   */
  groupTierBonus?: Partial<Record<'excellent' | 'standard' | 'poor', number>>;
  /**
   * 갭#1: 그룹 실적 달성률(%) → tier(우수/보통/미흡) 경계(설정 가능).
   * achievementRate ≥ excellent → excellent, ≥ standard → standard, 그 미만 → poor.
   * 미설정 시 ScoringService 가 { excellent: 100, standard: 90 } 폴백.
   */
  groupTierThresholds?: { excellent: number; standard: number };
  /**
   * 갭#2: 매출 절대금액(원) → 등급 척도(설정 가능). 내림차순 매칭.
   * measureType=amount && Kpi.useAbsoluteAmount=true 인 KPI 의 등급 산출에 사용.
   * 미설정 시 ScoringService 가 2026 기본([S 1e9 / A 8e8 / B 6e8 / C 4e8 / D 0]) 폴백.
   */
  revenueGradeScale?: { grade: Grade; minAmount: number }[];
  /**
   * 다단계 평가 단계 가중치(설정 가능). 합산 = 1차(팀장)·2차(본부장)·최종(대표) 가중평균.
   * 2026 기본: { teamLeader: 0.5, divisionHead: 0.3, ceo: 0.2 }. 없는 단계는 제외 후 재정규화.
   * (기존 evaluatorWeights 키와 동일 — results.aggregate 가 이미 사용.)
   */
  stageWeights?: { teamLeader: number; divisionHead: number; ceo: number };
  evaluatorWeights?: { teamLeader: number; divisionHead: number; ceo: number };
  /**
   * 최종점수 = 합산실적×perf + 합산역량×comp (설정 가능). 2026 기본 { perf: 0.7, comp: 0.3 }.
   * 역량(comp) 미입력 시 실적 100% 로 재정규화.
   */
  perfCompWeights?: { perf: number; comp: number };
  // 그 외 정책(gradeScale 등)은 모듈별로 동적 참조.
  [key: string]: unknown;
}

export interface ParsedRuleSet {
  gradeScale: GradeScaleBand[];
  gradingScales: GradingScales;
  poolRatios: PoolRatios;
  raiseRates: RaiseRates;
  weightPolicy: WeightPolicy;
}

export type { GroupTier, MeasureType };
