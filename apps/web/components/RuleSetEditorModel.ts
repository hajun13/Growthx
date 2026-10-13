// 평가 규칙 에디터 — 모델(타입·상수·검증). 시그니처·로직은 RulesView 가 의존하므로 불변.
import type { Grade } from '@/lib/types';

export const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
export const TIERS = ['excellent', 'standard', 'poor'] as const;
export type Tier = (typeof TIERS)[number];
export const tierLabel: Record<Tier, string> = {
  excellent: '우수',
  standard: '보통',
  poor: '미흡',
};

// amount/rate 밴드(하한/상한). count 는 KPI별 grading 이라 안내만.
export interface RuleSetDraft {
  gradeScale: { grade: Grade; min: number; max: number }[];
  gradingScales: {
    amount: { grade: Grade; minRate: number; maxRate: number | null }[];
    rate: { grade: Grade; minRate: number; maxRate: number | null }[];
  };
  poolRatios: Record<Tier, Record<Grade, number>>;
  raiseRates: Record<Grade, number>;
  // 그룹 실적 tier 별 인상률 가산(%). 음수 허용(미흡 −1 등).
  groupTierBonus: Record<Tier, number>;
  // 갭 #1 — 그룹 실적 달성률(%) tier 경계. excellent 이상→우수, standard 이상→보통, 미만→미흡.
  groupTierThresholds: { excellent: number; standard: number };
  // (2026-07-07) 매출 절대금액 등급(revenueGradeScale) 편집 UI 제거 — 실사용 0건.
  // DB 의 기존 키는 RulesView toPatchBody 의 weightPolicy 스프레드 머지로 보존된다.
  // 다단계 평가 단계 가중치(1차 팀장·2차 본부장·최종 대표) + 최종점수 실적/역량 가중.
  stageWeights: { teamLeader: number; divisionHead: number; ceo: number };
  perfCompWeights: { perf: number; comp: number };
  weightPolicy: {
    totalMustEqual: number;
    qualitativeMaxPercent: number;
    // 갭 #3 — KPI 그룹 가중치(합 100, 편집 가능)·강제 플래그.
    kpiGroupWeights: { performance_core: number; collaboration_growth: number };
    enforceQualitativeCap: boolean;
    enforceGroupRatio: boolean;
  };
}

export interface RuleSetEditorProps {
  value: RuleSetDraft;
  onChange: (v: RuleSetDraft) => void;
  measureTab: 'amount' | 'rate';
  onMeasureTabChange: (t: 'amount' | 'rate') => void;
}

// ── 검증(프론트 즉시 피드백, 최종은 백엔드) — 시그니처·로직 불변 ──
export function validateRuleSet(v: RuleSetDraft): {
  ok: boolean;
  gradeScale?: string;
  gradingScales?: string;
  poolRatios?: string;
  raiseRates?: string;
  groupTierBonus?: string;
  groupTierThresholds?: string;
  weightPolicy?: string;
} {
  const errors: ReturnType<typeof validateRuleSet> = { ok: true };

  // 등급 척도: min<=max, 구간 겹침 없음.
  for (const e of v.gradeScale) {
    if (e.min > e.max) {
      errors.gradeScale = '등급 구간의 최소점이 최대점보다 클 수 없어요.';
    }
  }
  // 인접 등급 겹침/역전(S>A>B>C>D 순으로 min 내림차순).
  // 위 등급 최소점이 아래 등급 최대점 이하면 두 구간이 겹친다(예: S 80~100 vs A 70~85 → 80~85 겹침).
  const sorted = GRADES.map((g) => v.gradeScale.find((e) => e.grade === g)!);
  for (let i = 0; i < sorted.length - 1; i++) {
    const hi = sorted[i];
    const lo = sorted[i + 1];
    if (!hi || !lo) continue;
    if (hi.min <= lo.max) {
      errors.gradeScale = '등급 구간이 겹치거나 순서가 어긋났어요.';
    } else if (hi.min - lo.max > 1) {
      // 갭 검증 — 백엔드 판정은 min 내림차순 매칭이라 빈 구간의 점수는 화면 표시와 달리
      // 아래 등급으로 떨어진다(예: A ~84 / S 90~ 이면 85~89점은 A). 표시·판정 불일치 차단.
      const gapStart = lo.max + 1;
      const gapEnd = hi.min - 1;
      const range = gapStart === gapEnd ? `${gapStart}점` : `${gapStart}~${gapEnd}점`;
      errors.gradeScale = `등급 사이에 빈 점수 구간이 있어요 — ${range}은 아래 등급(${lo.grade})으로 판정돼요.`;
    }
  }

  // 달성률 밴드: 존재 + 음수 하한 금지 + 상한<하한 금지 + 인접 등급 역전/겹침 없음.
  for (const key of ['amount', 'rate'] as const) {
    const bands = v.gradingScales[key];
    if (!bands || bands.length === 0) {
      errors.gradingScales = '측정방식별 달성률표를 입력해 주세요.';
      continue;
    }
    const byGrade = GRADES.map((g) => bands.find((b) => b.grade === g));
    for (const b of byGrade) {
      if (!b) continue;
      if (typeof b.minRate !== 'number' || Number.isNaN(b.minRate) || b.minRate < 0) {
        errors.gradingScales = '달성률 하한은 0 이상의 숫자여야 해요.';
      } else if (b.maxRate != null && b.maxRate < b.minRate) {
        errors.gradingScales = '달성률 상한이 하한보다 작을 수 없어요.';
      }
    }
    // 인접 등급(위 = 높은 등급): 위 등급 하한은 아래 등급 하한보다 커야 하고(역전),
    // 아래 등급 상한이 위 등급 하한을 넘으면 겹침.
    for (let i = 0; i < byGrade.length - 1; i++) {
      const hi = byGrade[i];
      const lo = byGrade[i + 1];
      if (!hi || !lo) continue;
      if (lo.minRate >= hi.minRate) {
        errors.gradingScales = '위 등급의 달성률 하한은 아래 등급보다 커야 해요.';
      } else if (lo.maxRate != null && lo.maxRate > hi.minRate) {
        errors.gradingScales = '달성률 구간이 겹쳐요. 인접 등급의 상한·하한을 확인해 주세요.';
      }
    }
  }

  // 풀 비율: 각 tier 합 = 100(±0.01).
  for (const t of TIERS) {
    const sum = GRADES.reduce((acc, g) => acc + (v.poolRatios[t][g] || 0), 0);
    if (Math.abs(sum - 100) > 0.01) {
      errors.poolRatios = `${tierLabel[t]} 그룹의 풀 비율 합이 100%가 아니에요.`;
    }
  }

  // 인상률: 음수 불가.
  for (const g of GRADES) {
    if (v.raiseRates[g] < 0) errors.raiseRates = '인상률은 음수가 될 수 없어요.';
  }

  // 그룹실적 보너스: 음수 허용, 숫자(NaN 불가)만 가볍게 검증.
  for (const t of TIERS) {
    const b = v.groupTierBonus[t];
    if (typeof b !== 'number' || Number.isNaN(b)) {
      errors.groupTierBonus = '그룹실적 보너스는 숫자여야 해요.';
    }
  }

  // 갭 #1 — 그룹실적 tier 경계: excellent > standard, 둘 다 숫자.
  const gt = v.groupTierThresholds;
  if (
    typeof gt.excellent !== 'number' ||
    typeof gt.standard !== 'number' ||
    Number.isNaN(gt.excellent) ||
    Number.isNaN(gt.standard)
  ) {
    errors.groupTierThresholds = '우수·보통 경계는 숫자여야 해요.';
  } else if (gt.excellent <= gt.standard) {
    errors.groupTierThresholds = '우수 경계는 보통 경계보다 커야 해요.';
  }

  // 정성 상한: 0~100. + 갭 #3 그룹 가중치 합 100.
  const q = v.weightPolicy.qualitativeMaxPercent;
  const kw = v.weightPolicy.kpiGroupWeights;
  const kwSum = (kw.performance_core || 0) + (kw.collaboration_growth || 0);
  if (q < 0 || q > 100) {
    errors.weightPolicy = '정성 상한은 0~100% 사이여야 해요.';
  } else if (Math.abs(kwSum - 100) > 0.01) {
    errors.weightPolicy = `그룹 가중치 합이 100%가 아니에요(현재 ${Math.round(kwSum * 10) / 10}%).`;
  }

  // 다단계 단계 가중치(1차·2차·최종) 합 = 1(또는 100 스케일) / 실적·역량 가중 합 = 1(또는 100).
  const sumsToOne = (sum: number) =>
    Math.abs(sum - 1) <= 0.001 || Math.abs(sum - 100) <= 0.01;
  const sw = v.stageWeights;
  const swSum = (sw?.teamLeader || 0) + (sw?.divisionHead || 0) + (sw?.ceo || 0);
  if (!errors.weightPolicy && !sumsToOne(swSum)) {
    errors.weightPolicy = `단계 가중치(1차·2차·최종) 합이 1이 아니에요(현재 ${Math.round(swSum * 100) / 100}).`;
  }
  const pcw = v.perfCompWeights;
  const pcSum = (pcw?.perf || 0) + (pcw?.comp || 0);
  if (!errors.weightPolicy && !sumsToOne(pcSum)) {
    errors.weightPolicy = `실적·역량 가중치 합이 1이 아니에요(현재 ${Math.round(pcSum * 100) / 100}).`;
  }

  errors.ok =
    !errors.gradeScale &&
    !errors.gradingScales &&
    !errors.poolRatios &&
    !errors.raiseRates &&
    !errors.groupTierBonus &&
    !errors.groupTierThresholds &&
    !errors.weightPolicy;
  return errors;
}
