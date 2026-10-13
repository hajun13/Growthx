// 평가 규칙 — RuleSet(API) ↔ RuleSetDraft(편집 모델) 매핑·기본값. RulesView 가 사용.
import type { RuleSetDraft } from '@/components/RuleSetEditor';
import type { Grade, RuleSet } from '@/lib/types';

export const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// groupTierBonus 미설정 시 기본값(business-rules §5, 2026 seed — 백엔드와 동일).
const DEFAULT_GROUP_TIER_BONUS: RuleSetDraft['groupTierBonus'] = {
  excellent: 2,
  standard: 0,
  poor: -1,
};

// 갭 #1·#2·#3 미설정 시 기본값(contract-ruleset-gaps.md — 백엔드 2026 폴백과 동일).
const DEFAULT_GROUP_TIER_THRESHOLDS: RuleSetDraft['groupTierThresholds'] = {
  excellent: 100,
  standard: 90,
};
const DEFAULT_KPI_GROUP_WEIGHTS: RuleSetDraft['weightPolicy']['kpiGroupWeights'] = {
  performance_core: 80,
  collaboration_growth: 20,
};

// RuleSet(API) → RuleSetDraft(편집 모델). groupTierBonus·신규 5필드는 weightPolicy 에서 추출.
export function toDraft(rs: RuleSet): RuleSetDraft {
  const wp = rs.weightPolicy;
  const gtb: Partial<RuleSetDraft['groupTierBonus']> = wp.groupTierBonus ?? {};
  return {
    gradeScale: GRADES.map((g) => {
      const e = rs.gradeScale.find((x) => x.grade === g);
      return { grade: g, min: e?.min ?? 0, max: e?.max ?? 0 };
    }),
    gradingScales: {
      amount: GRADES.map((g) => {
        const e = rs.gradingScales.amount.find((x) => x.grade === g);
        return { grade: g, minRate: e?.minRate ?? 0, maxRate: e?.maxRate ?? null };
      }),
      rate: GRADES.map((g) => {
        const e = rs.gradingScales.rate.find((x) => x.grade === g);
        return { grade: g, minRate: e?.minRate ?? 0, maxRate: e?.maxRate ?? null };
      }),
    },
    poolRatios: {
      excellent: { ...rs.poolRatios.excellent },
      standard: { ...rs.poolRatios.standard },
      poor: { ...rs.poolRatios.poor },
    },
    raiseRates: { ...rs.raiseRates },
    groupTierBonus: {
      excellent: gtb.excellent ?? DEFAULT_GROUP_TIER_BONUS.excellent,
      standard: gtb.standard ?? DEFAULT_GROUP_TIER_BONUS.standard,
      poor: gtb.poor ?? DEFAULT_GROUP_TIER_BONUS.poor,
    },
    groupTierThresholds: {
      excellent:
        wp.groupTierThresholds?.excellent ??
        DEFAULT_GROUP_TIER_THRESHOLDS.excellent,
      standard:
        wp.groupTierThresholds?.standard ??
        DEFAULT_GROUP_TIER_THRESHOLDS.standard,
    },
    stageWeights: {
      teamLeader: wp.stageWeights?.teamLeader ?? wp.evaluatorWeights?.teamLeader ?? 0.5,
      divisionHead: wp.stageWeights?.divisionHead ?? wp.evaluatorWeights?.divisionHead ?? 0.3,
      ceo: wp.stageWeights?.ceo ?? wp.evaluatorWeights?.ceo ?? 0.2,
    },
    perfCompWeights: {
      // 역량은 등급산정 미반영(참고용) → 기본 실적 1·역량 0.
      perf: wp.perfCompWeights?.perf ?? 1,
      comp: wp.perfCompWeights?.comp ?? 0,
    },
    weightPolicy: {
      totalMustEqual: wp.totalMustEqual,
      qualitativeMaxPercent: wp.qualitativeMaxPercent,
      kpiGroupWeights: {
        performance_core:
          wp.kpiGroupWeights?.performance_core ??
          DEFAULT_KPI_GROUP_WEIGHTS.performance_core,
        collaboration_growth:
          wp.kpiGroupWeights?.collaboration_growth ??
          DEFAULT_KPI_GROUP_WEIGHTS.collaboration_growth,
      },
      enforceQualitativeCap: wp.enforceQualitativeCap ?? false,
      enforceGroupRatio: wp.enforceGroupRatio ?? false,
    },
  };
}

// RuleSetDraft → PATCH 바디(API shape). 편집 필드는 weightPolicy 안으로 직렬화(계약 §공통 원칙).
// weightPolicy 는 원본(source)을 base 로 스프레드 — 이 화면이 노출하지 않는 정책 키
// (예: seed 의 stageExceptionWeights, 편집 UI 를 제거한 revenueGradeScale)를 저장 시
// 삭제하지 않고 보존한다(백엔드 머지와 이중 방어).
export function toPatchBody(d: RuleSetDraft, source: RuleSet): Partial<RuleSet> {
  return {
    gradeScale: d.gradeScale,
    gradingScales: d.gradingScales,
    poolRatios: d.poolRatios,
    raiseRates: d.raiseRates,
    weightPolicy: {
      ...source.weightPolicy,
      totalMustEqual: d.weightPolicy.totalMustEqual,
      qualitativeMaxPercent: d.weightPolicy.qualitativeMaxPercent,
      groupTierBonus: d.groupTierBonus,
      groupTierThresholds: d.groupTierThresholds,
      kpiGroupWeights: d.weightPolicy.kpiGroupWeights,
      enforceQualitativeCap: d.weightPolicy.enforceQualitativeCap,
      enforceGroupRatio: d.weightPolicy.enforceGroupRatio,
      // 다단계 평가 가중치 — stageWeights·evaluatorWeights 두 키 동기화(aggregate 폴백 호환).
      stageWeights: d.stageWeights,
      evaluatorWeights: d.stageWeights,
      perfCompWeights: d.perfCompWeights,
    },
  };
}

export function rulesSubtitle(cycleName?: string): string {
  return `등급 척도·달성률·그룹풀·인상률·그룹실적 보너스 등 평가 산정 규칙을 설정합니다.${
    cycleName ? ` (현재 주기: ${cycleName})` : ''
  }`;
}
