import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Grade, GroupTier, MeasureType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CountGradeBand,
  GradeScaleBand,
  GradingScales,
  ParsedRuleSet,
  PoolRow,
  RateGradeBand,
  WeightPolicy,
} from './rule-set.types';

/** 갭#2: 매출 절대금액 등급 척도 기본값(2026). revenueGradeScale 미설정 시 폴백. */
const DEFAULT_REVENUE_GRADE_SCALE: { grade: Grade; minAmount: number }[] = [
  { grade: Grade.S, minAmount: 1_000_000_000 },
  { grade: Grade.A, minAmount: 800_000_000 },
  { grade: Grade.B, minAmount: 600_000_000 },
  { grade: Grade.C, minAmount: 400_000_000 },
  { grade: Grade.D, minAmount: 0 },
];

/** 갭#1: 그룹 실적 달성률 → tier 경계 기본값(2026). */
const DEFAULT_GROUP_TIER_THRESHOLDS = { excellent: 100, standard: 90 };

/** 다단계 평가 단계 가중치 기본값(2026): 1차 팀장 0.5 · 2차 본부장 0.3 · 최종 대표 0.2. */
export const DEFAULT_STAGE_WEIGHTS = { teamLeader: 0.5, divisionHead: 0.3, ceo: 0.2 };
/**
 * 최종점수 실적/역량 가중 기본값(2026 운영계획 PPT).
 * 역량은 **등급산정 미반영(참고용)** → 실적 100% · 역량 0%.
 * (역량 점수는 byType.compScore 로 저장·표시만 하며 최종등급에 영향 없음.)
 */
export const DEFAULT_PERF_COMP_WEIGHTS = { perf: 1, comp: 0 };
/**
 * 다단계 예외 상황②(2차 평가자 = 최종평가자) 가중치 기본값(PPT 예외 ②):
 * 1차 평가 70% + 최종평가 30%. 예외 ①(1차=최종)은 1차 100%(가중치 불필요).
 */
export const DEFAULT_STAGE_EXCEPTION_WEIGHTS = { ex2Round1: 0.7, ex2Final: 0.3 };

/**
 * 규칙 엔진 (설정 가능).
 * 점수→등급·측정방식별 달성률/건수→등급·가중치·총점·풀 상한·인상률을 RuleSet 에서 읽어 계산한다.
 * 상수를 코드에 박지 않는다. business-rules §1~5 흐름 그대로.
 *
 * ⚠️ v2: 측정방식별 등급(amount/rate=달성률표, count=KPI별 건수 임계값, qualitative=직접부여).
 */
@Injectable()
export class ScoringService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * cycle 의 RuleSet 을 파싱해 반환.
   * 주기에 RuleSet 미연결 시 글로벌 default(cycleId=null) 폴백 → 404 방지(A 요구).
   * 글로벌도 없으면 NOT_FOUND.
   */
  async loadRuleSetForCycle(cycleId: string): Promise<ParsedRuleSet> {
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: cycleId },
      include: { ruleSet: true },
    });
    if (cycle?.ruleSet) {
      return this.parse(cycle.ruleSet);
    }
    // 폴백: 글로벌 default RuleSet (cycleId 미연결, 가장 최근).
    const fallback = await this.prisma.ruleSet.findFirst({
      where: { cycleId: null },
      orderBy: { createdAt: 'desc' },
    });
    if (fallback) {
      return this.parse(fallback);
    }
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: '해당 주기의 규칙 세트를 찾을 수 없어요.',
    });
  }

  parse(ruleSet: {
    gradeScale: unknown;
    gradingScales: unknown;
    poolRatios: unknown;
    raiseRates: unknown;
    weightPolicy: unknown;
  }): ParsedRuleSet {
    return {
      gradeScale: ruleSet.gradeScale as GradeScaleBand[],
      gradingScales: ruleSet.gradingScales as GradingScales,
      poolRatios: ruleSet.poolRatios as ParsedRuleSet['poolRatios'],
      raiseRates: ruleSet.raiseRates as ParsedRuleSet['raiseRates'],
      weightPolicy: ruleSet.weightPolicy as WeightPolicy,
    };
  }

  // ── §1 점수 → 등급 ──
  scoreToGrade(score: number, gradeScale: GradeScaleBand[]): Grade {
    // 기본 gradeScale에 S(96~100) 구간이 없으면 최상단에 추가
    const hasS = gradeScale.some((b) => b.grade === Grade.S);
    const effectiveScale = hasS
      ? gradeScale
      : [{ grade: Grade.S, min: 96, max: 100 }, ...gradeScale];
    const band = effectiveScale.find((b) => score >= b.min && score <= b.max);
    if (band) return band.grade;
    // 구간 밖(최저) → 가장 낮은 등급
    const sorted = [...effectiveScale].sort((a, b) => a.min - b.min);
    return sorted[0]?.grade ?? Grade.D;
  }

  /**
   * 갭#2: 매출 절대금액(원) → 등급 산출.
   * revenueGradeScale 을 내림차순으로 정렬해 actualAmount 가 minAmount 이상인 첫 등급 반환.
   * scale 미전달 시 2026 기본값 폴백(기존 데이터 호환).
   */
  revenueGrade(
    actualAmount: number | null,
    scale?: { grade: Grade; minAmount: number }[] | null,
  ): Grade {
    if (actualAmount == null) return Grade.D;
    const effective = scale?.length ? scale : DEFAULT_REVENUE_GRADE_SCALE;
    const entry = [...effective]
      .sort((a, b) => b.minAmount - a.minAmount)
      .find((e) => actualAmount >= e.minAmount);
    return entry?.grade ?? Grade.D;
  }

  // ── §2 측정방식별 raw 등급 매핑 ──
  /**
   * 측정방식(measureType)에 따라 KPI raw 등급을 산출한다.
   * - amount/rate: 달성률(rate, %) → RuleSet.gradingScales 표.
   * - amount + useAbsoluteAmount=true(갭#2): 실제 매출 절대금액(actualAmount) → revenueGradeScale.
   * - count: 건수(rate 자리에 actualValue) → KPI별 grading(CountGradeBand[]) 임계값.
   * - qualitative: 평가자가 직접 부여한 등급(directGrade) 사용.
   *
   * opts 는 선택적 — 미전달 시 모든 amount 는 기존 달성률표 경로(폴백, 기존 데이터 호환).
   */
  measureToGrade(
    measureType: MeasureType,
    value: number | null,
    gradingScales: GradingScales,
    countGrading: CountGradeBand[] | null,
    directGrade: Grade | null,
    opts?: {
      useAbsoluteAmount?: boolean;
      actualAmount?: number | null;
      revenueGradeScale?: { grade: Grade; minAmount: number }[] | null;
    },
  ): Grade {
    if (measureType === MeasureType.qualitative) {
      return directGrade ?? Grade.D;
    }
    if (measureType === MeasureType.count) {
      if (value == null || !countGrading?.length) return Grade.D;
      return this.countToGrade(value, countGrading);
    }
    // amount + 절대금액 모드(갭#2): 달성률 대신 실제 금액 → revenueGradeScale.
    if (measureType === MeasureType.amount && opts?.useAbsoluteAmount) {
      return this.revenueGrade(opts.actualAmount ?? null, opts.revenueGradeScale ?? null);
    }
    // amount | rate → 달성률 표
    if (value == null) return Grade.D;
    const bands =
      measureType === MeasureType.amount ? gradingScales.amount : gradingScales.rate;
    return this.rateToGrade(value, bands);
  }

  /** 달성률(%) → 등급 (amount/rate). */
  rateToGrade(rate: number, bands: RateGradeBand[]): Grade {
    const band = bands.find(
      (b) => rate >= b.minRate && (b.maxRate === null || rate <= b.maxRate),
    );
    return band?.grade ?? Grade.D;
  }

  /** 건수 → 등급 (count, KPI별 임계값). */
  countToGrade(count: number, bands: CountGradeBand[]): Grade {
    const band = bands.find(
      (b) => count >= b.minCount && (b.maxCount === null || count <= b.maxCount),
    );
    return band?.grade ?? Grade.D;
  }

  /** 등급의 점수 구간 중앙값을 raw 점수로 사용 (KPI raw 점수 산출용). */
  gradeToScore(grade: Grade, gradeScale: GradeScaleBand[]): number {
    const band = gradeScale.find((b) => b.grade === grade);
    if (!band) return 0;
    return Math.round((band.min + band.max) / 2);
  }

  // ── §4 가중치 검증 ──
  /**
   * 같은 사용자·주기 KPI 집합의 가중치 규칙 검증(설정 가능 — 모두 weightPolicy 에서 읽음).
   *
   * ⚠️ 제품 결정(2026-06-08): KPI 작성을 "전부 서술형(qualitative)"으로 전환하면서,
   *    서술형 KPI 는 제출 검증을 면제한다. 따라서 아래 검사들을 **기본 비차단**으로 완화했다.
   *    - 정성 비중 ≤ qualitativeMaxPercent(30%) 상한
   *    - KpiGroup 비율(성과중심 80% / 협업·성장 20%)
   *    business-rules 레퍼런스가 80/20·정성캡을 규정하지만 이번 제품 결정이 우선한다.
   *
   *  1) 총합 = totalMustEqual(기본 100) — **계속 차단(throw).** 총점 Σ(score×weight/100)
   *     정합성에 필수이므로 항상 강제한다.
   *  2) 정성(isQualitative) 합 ≤ qualitativeMaxPercent — `policy.enforceQualitativeCap === true`
   *     일 때만 검사. 기본(미설정/false)은 비차단(skip).
   *  3) KpiGroup 비율(성과중심/협업·성장) — `policy.enforceGroupRatio === true` 일 때만 검사.
   *     기본(미설정/false)은 비차단(skip). (group 정보가 없는 호출은 애초에 적용 불가.)
   *
   * 위반 시 VALIDATION_ERROR(BadRequest, 한국어).
   */
  validateWeights(
    items: { weight: number; isQualitative: boolean; group?: string | null }[],
    policy: WeightPolicy,
  ): void {
    // (1) 가중치 합 = 100 — 유일하게 항상 차단하는 게이트.
    const total = items.reduce((sum, i) => sum + (i.weight ?? 0), 0);
    if (total !== policy.totalMustEqual) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `가중치 합은 ${policy.totalMustEqual}이어야 해요. (현재 ${total})`,
      });
    }

    // (2) 정성 비중 상한 — 옵트인일 때만(기본 비차단). 전부 서술형 전환으로 면제.
    if (policy.enforceQualitativeCap === true) {
      const qualitative = items
        .filter((i) => i.isQualitative)
        .reduce((sum, i) => sum + (i.weight ?? 0), 0);
      if (qualitative > policy.qualitativeMaxPercent) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `정성 항목 가중치는 ${policy.qualitativeMaxPercent}%를 넘을 수 없어요. (현재 ${qualitative}%)`,
        });
      }
    }

    // (3) KpiGroup 비율(전사 공통 80/20) — 옵트인일 때만(기본 비차단). 전부 서술형 전환으로 면제.
    const hasGroup = items.some((i) => i.group != null);
    if (policy.enforceGroupRatio === true && hasGroup) {
      const target = policy.kpiGroupWeights ?? {};
      const expectedCore = target.performance_core ?? 80;
      const expectedCollab = target.collaboration_growth ?? 20;
      const sumOf = (group: string) =>
        items
          .filter((i) => i.group === group)
          .reduce((sum, i) => sum + (i.weight ?? 0), 0);
      const coreSum = sumOf('performance_core');
      const collabSum = sumOf('collaboration_growth');
      if (coreSum !== expectedCore) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `성과중심 KPI 가중치 합은 ${expectedCore}%여야 해요. (현재 ${coreSum}%)`,
        });
      }
      if (collabSum !== expectedCollab) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `협업·성장 KPI 가중치 합은 ${expectedCollab}%여야 해요. (현재 ${collabSum}%)`,
        });
      }
    }
  }

  // ── §4 총점 = Σ(score × weight / 100) ──
  computeTotalScore(items: { score: number; weight: number }[]): number {
    const total = items.reduce(
      (sum, i) => sum + ((i.score ?? 0) * (i.weight ?? 0)) / 100,
      0,
    );
    return Math.round(total * 100) / 100;
  }

  // ── §3 그룹 등급 풀 상한 검증 ──
  /**
   * 그룹 구성원 등급 분포가 풀 상한(%)을 초과하는지 검증.
   * 초과 시 POOL_EXCEEDED(422). 데이터 무결성 — 제출 차단.
   */
  checkPool(
    grades: Grade[],
    tier: GroupTier,
    poolRatios: ParsedRuleSet['poolRatios'],
  ): { ok: boolean; violations: { grade: Grade; count: number; cap: number }[] } {
    const total = grades.length;
    const row: PoolRow = poolRatios[tier];
    const violations: { grade: Grade; count: number; cap: number }[] = [];
    (Object.keys(row) as Grade[]).forEach((grade) => {
      const count = grades.filter((g) => g === grade).length;
      // 상한: 비율(%)을 인원으로 환산(올림). 초과 시 위반.
      const cap = Math.ceil((row[grade] / 100) * total);
      if (count > cap) {
        violations.push({ grade, count, cap });
      }
    });
    return { ok: violations.length === 0, violations };
  }

  /**
   * 갭#1: 그룹 실적 달성률 → tier 분류 (excellent/standard/poor).
   * thresholds 미전달 시 { excellent: 100, standard: 90 } 폴백(기존 데이터 호환).
   */
  achievementRateToTier(
    rate: number,
    thresholds?: { excellent: number; standard: number } | null,
  ): GroupTier {
    const t = thresholds ?? DEFAULT_GROUP_TIER_THRESHOLDS;
    if (rate >= t.excellent) return GroupTier.excellent;
    if (rate >= t.standard) return GroupTier.standard;
    return GroupTier.poor;
  }

  // ── §5 인상률 ──
  raiseRateForGrade(grade: Grade, raiseRates: ParsedRuleSet['raiseRates']): number {
    return raiseRates[grade] ?? 0;
  }

  // ── 다단계 평가 합산 (1차 팀장·2차 본부장·최종 대표) ──
  /**
   * 단계 점수(실적 또는 역량)를 단계 가중치로 합산한다.
   * 없는 단계(null)는 제외하고 남은 단계 가중치로 재정규화한다. 모두 null 이면 null.
   * weightPolicy.stageWeights(또는 evaluatorWeights) 미설정 시 2026 기본(0.5/0.3/0.2).
   */
  combineStages(
    stages: { teamLeader?: number | null; divisionHead?: number | null; ceo?: number | null },
    weights?: { teamLeader: number; divisionHead: number; ceo: number } | null,
  ): number | null {
    const w = weights ?? DEFAULT_STAGE_WEIGHTS;
    const pairs: [number | null | undefined, number][] = [
      [stages.teamLeader, w.teamLeader],
      [stages.divisionHead, w.divisionHead],
      [stages.ceo, w.ceo],
    ];
    let weighted = 0;
    let total = 0;
    for (const [v, wi] of pairs) {
      if (v != null) {
        weighted += v * wi;
        total += wi;
      }
    }
    if (total === 0) return null;
    return Math.round((weighted / total) * 10000) / 10000;
  }

  /**
   * 다단계 실적 합산 + **예외 상황(평가자 동일인) 적용** (PPT 평가 프로세스).
   * 평가자 ID 로 단계 붕괴를 감지해 고정비율을 적용한다:
   *  - 예외①: 1차 평가자 = 최종평가자 → **1차 100%**.
   *  - 예외②: 2차 평가자 = 최종평가자(1차와는 다름·1차 존재) → **1차 70% + 최종 30%**.
   *  - 그 외(정상 3단계 또는 일부 단계 부재): combineStages 로 단계가중 재정규화.
   * 최종평가자 = 가장 높은 단계(round3→2→1)의 평가자, 최종점수 = 해당 단계 점수.
   * ex2 비율 미전달 시 DEFAULT_STAGE_EXCEPTION_WEIGHTS(0.7/0.3).
   */
  combineStagesWithExceptions(
    scores: { round1: number | null; round2: number | null; round3: number | null },
    evaluators: { round1?: string | null; round2?: string | null; round3?: string | null },
    weights?: { teamLeader: number; divisionHead: number; ceo: number } | null,
    ex2?: { ex2Round1: number; ex2Final: number } | null,
  ): { score: number | null; mode: 'normal' | 'exception1' | 'exception2' } {
    const ev1 = evaluators.round1 ?? null;
    const ev2 = evaluators.round2 ?? null;
    const ev3 = evaluators.round3 ?? null;
    const finalEvaluator = ev3 ?? ev2 ?? ev1;
    const finalScore = scores.round3 ?? scores.round2 ?? scores.round1;

    // 예외①: 1차 평가자 = 최종평가자 → 1차 100%.
    if (ev1 && finalEvaluator && finalEvaluator === ev1) {
      return { score: scores.round1 ?? finalScore, mode: 'exception1' };
    }
    // 예외②: 2차 평가자 = 최종평가자(1차와 다름·1차 점수 존재) → 1차 70% + 최종 30%.
    if (ev2 && finalEvaluator && finalEvaluator === ev2 && scores.round1 != null) {
      const w = ex2 ?? DEFAULT_STAGE_EXCEPTION_WEIGHTS;
      const fin = finalScore ?? scores.round1;
      const s = scores.round1 * w.ex2Round1 + fin * w.ex2Final;
      return { score: Math.round(s * 10000) / 10000, mode: 'exception2' };
    }
    // 정상: 단계 가중 재정규화(없는 단계 제외).
    return {
      score: this.combineStages(
        { teamLeader: scores.round1, divisionHead: scores.round2, ceo: scores.round3 },
        weights,
      ),
      mode: 'normal',
    };
  }

  /**
   * 최종점수 = 합산실적×perf + 합산역량×comp (가중 결합).
   * 역량(comp) null 이면 실적 100% 로 재정규화. 둘 다 null 이면 null.
   * weightPolicy.perfCompWeights 미설정 시 2026 기본(perf 1·comp 0 — 역량 등급 미반영).
   */
  combineFinal(
    perf: number | null,
    comp: number | null,
    weights?: { perf: number; comp: number } | null,
  ): number | null {
    const w = weights ?? DEFAULT_PERF_COMP_WEIGHTS;
    let weighted = 0;
    let total = 0;
    if (perf != null) {
      weighted += perf * w.perf;
      total += w.perf;
    }
    if (comp != null) {
      weighted += comp * w.comp;
      total += w.comp;
    }
    if (total === 0) return null;
    return Math.round((weighted / total) * 10000) / 10000;
  }

  // ── RuleSet 전 필드 검증 (A: PATCH/POST 수용 시) ──
  /**
   * gradeScale·gradingScales·poolRatios·raiseRates·weightPolicy 전 필드 무결성 검증.
   * - gradeScale: 5등급(S~D) 존재, min≤max, 구간 단조성(겹침 없음).
   * - gradingScales.amount/rate: minRate≤maxRate(또는 null).
   * - poolRatios: 각 tier 비율 합 = 100(±0.01).
   * - raiseRates: 모든 등급 number.
   * - weightPolicy: totalMustEqual·qualitativeMaxPercent number.
   * 부분 PATCH 도 지원 — 제공된 필드만 검증.
   */
  validateRuleSet(input: {
    gradeScale?: unknown;
    gradingScales?: unknown;
    poolRatios?: unknown;
    raiseRates?: unknown;
    weightPolicy?: unknown;
  }): void {
    const fail = (message: string): never => {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message });
    };
    const grades: Grade[] = [Grade.S, Grade.A, Grade.B, Grade.C, Grade.D];

    if (input.gradeScale !== undefined) {
      const bands = input.gradeScale as GradeScaleBand[];
      if (!Array.isArray(bands) || bands.length === 0) fail('등급 척도(gradeScale)가 비어 있어요.');
      for (const g of grades) {
        if (!bands.some((b) => b.grade === g)) fail(`등급 척도에 ${g} 구간이 없어요.`);
      }
      for (const b of bands) {
        if (typeof b.min !== 'number' || typeof b.max !== 'number' || b.min > b.max) {
          fail(`등급 ${b.grade}의 점수 구간이 올바르지 않아요(min ≤ max).`);
        }
      }
      // 단조성: 높은 등급의 min 이 낮은 등급의 max 보다 커야(겹침 없음). S>A>B>C>D 순.
      const order: Grade[] = [Grade.S, Grade.A, Grade.B, Grade.C, Grade.D];
      for (let i = 0; i < order.length - 1; i++) {
        const hi = bands.find((b) => b.grade === order[i]);
        const lo = bands.find((b) => b.grade === order[i + 1]);
        if (hi && lo && hi.min <= lo.max) {
          fail(`등급 구간이 겹쳐요(${order[i]}.min 은 ${order[i + 1]}.max 보다 커야 해요).`);
        }
      }
    }

    if (input.gradingScales !== undefined) {
      const gs = input.gradingScales as GradingScales;
      for (const key of ['amount', 'rate'] as const) {
        const bands = gs?.[key];
        if (!Array.isArray(bands) || bands.length === 0) {
          fail(`측정방식별 달성률표(${key})가 비어 있어요.`);
        }
        for (const b of bands as RateGradeBand[]) {
          if (typeof b.minRate !== 'number') fail(`달성률표(${key})의 minRate 가 올바르지 않아요.`);
          if (b.maxRate !== null && typeof b.maxRate === 'number' && b.maxRate < b.minRate) {
            fail(`달성률표(${key}) ${b.grade}의 구간이 올바르지 않아요(minRate ≤ maxRate).`);
          }
        }
      }
    }

    if (input.poolRatios !== undefined) {
      const pr = input.poolRatios as Record<string, Record<string, number>>;
      for (const tier of ['excellent', 'standard', 'poor']) {
        const row = pr?.[tier];
        if (!row) fail(`풀 비율(poolRatios)에 ${tier} tier 가 없어요.`);
        const sum = grades.reduce((s, g) => s + (Number(row[g]) || 0), 0);
        if (Math.abs(sum - 100) > 0.01) {
          fail(`${tier} 풀 비율 합이 100이어야 해요. (현재 ${sum})`);
        }
      }
    }

    if (input.raiseRates !== undefined) {
      const rr = input.raiseRates as Record<string, number>;
      for (const g of grades) {
        if (typeof rr?.[g] !== 'number') fail(`인상률(raiseRates)에 ${g} 값이 없거나 숫자가 아니에요.`);
      }
    }

    if (input.weightPolicy !== undefined) {
      const wp = input.weightPolicy as WeightPolicy;
      if (typeof wp?.totalMustEqual !== 'number' || typeof wp?.qualitativeMaxPercent !== 'number') {
        fail('가중치 정책(weightPolicy)의 totalMustEqual·qualitativeMaxPercent 가 숫자여야 해요.');
      }
      if (wp.qualitativeMaxPercent < 0 || wp.qualitativeMaxPercent > 100) {
        fail('정성 상한(qualitativeMaxPercent)은 0~100 범위여야 해요.');
      }
      // groupTierBonus(제공 시): 각 tier 값이 숫자(음수·소수 허용)인지 가볍게 검증.
      if (wp.groupTierBonus !== undefined && wp.groupTierBonus !== null) {
        const gtb = wp.groupTierBonus as Record<string, unknown>;
        if (typeof gtb !== 'object') {
          fail('그룹 tier 보너스(groupTierBonus)는 객체여야 해요.');
        }
        for (const tier of ['excellent', 'standard', 'poor'] as const) {
          const v = gtb[tier];
          if (v !== undefined && (typeof v !== 'number' || Number.isNaN(v))) {
            fail(`그룹 tier 보너스(groupTierBonus.${tier})는 숫자여야 해요.`);
          }
        }
      }

      // 갭#1: groupTierThresholds(제공 시) — excellent·standard 숫자, excellent > standard.
      if (wp.groupTierThresholds !== undefined && wp.groupTierThresholds !== null) {
        const gt = wp.groupTierThresholds as Record<string, unknown>;
        if (typeof gt !== 'object') {
          fail('그룹 tier 경계(groupTierThresholds)는 객체여야 해요.');
        }
        const ex = gt.excellent;
        const st = gt.standard;
        if (
          typeof ex !== 'number' || Number.isNaN(ex) ||
          typeof st !== 'number' || Number.isNaN(st)
        ) {
          fail('그룹 tier 경계(groupTierThresholds.excellent·standard)는 숫자여야 해요.');
        }
        if ((ex as number) <= (st as number)) {
          fail('그룹 tier 경계는 우수(excellent)가 보통(standard)보다 커야 해요.');
        }
      }

      // 갭#2: revenueGradeScale(제공 시) — 5등급(S~D) 존재, minAmount 숫자·내림차순.
      if (wp.revenueGradeScale !== undefined && wp.revenueGradeScale !== null) {
        const scale = wp.revenueGradeScale as unknown;
        if (!Array.isArray(scale) || scale.length === 0) {
          fail('매출 절대금액 등급(revenueGradeScale)이 비어 있어요.');
        }
        const arr = scale as { grade?: unknown; minAmount?: unknown }[];
        for (const g of grades) {
          if (!arr.some((e) => e.grade === g)) {
            fail(`매출 절대금액 등급(revenueGradeScale)에 ${g} 등급이 없어요.`);
          }
        }
        for (const e of arr) {
          if (typeof e.minAmount !== 'number' || Number.isNaN(e.minAmount)) {
            fail(`매출 절대금액 등급(revenueGradeScale)의 ${String(e.grade)} minAmount 가 숫자가 아니에요.`);
          }
        }
        // S→A→B→C→D 순으로 minAmount 가 단조 감소(내림차순)여야 함.
        const order: Grade[] = [Grade.S, Grade.A, Grade.B, Grade.C, Grade.D];
        const byGrade = new Map(arr.map((e) => [e.grade, e.minAmount as number]));
        for (let i = 0; i < order.length - 1; i++) {
          const hi = byGrade.get(order[i]);
          const lo = byGrade.get(order[i + 1]);
          if (typeof hi === 'number' && typeof lo === 'number' && hi <= lo) {
            fail(`매출 절대금액 등급의 minAmount 는 내림차순이어야 해요(${order[i]} > ${order[i + 1]}).`);
          }
        }
      }

      // 갭#3: kpiGroupWeights(제공 시) — performance_core + collaboration_growth === 100.
      if (wp.kpiGroupWeights !== undefined && wp.kpiGroupWeights !== null) {
        const kw = wp.kpiGroupWeights as Record<string, unknown>;
        if (typeof kw !== 'object') {
          fail('KPI 그룹 가중치(kpiGroupWeights)는 객체여야 해요.');
        }
        const core = kw.performance_core;
        const collab = kw.collaboration_growth;
        if (
          typeof core !== 'number' || Number.isNaN(core) ||
          typeof collab !== 'number' || Number.isNaN(collab)
        ) {
          fail('KPI 그룹 가중치(performance_core·collaboration_growth)는 숫자여야 해요.');
        }
        if ((core as number) + (collab as number) !== 100) {
          fail(`KPI 그룹 가중치 합은 100이어야 해요. (현재 ${(core as number) + (collab as number)})`);
        }
      }

      // 갭#3: enforceQualitativeCap·enforceGroupRatio(제공 시) — boolean.
      for (const flag of ['enforceQualitativeCap', 'enforceGroupRatio'] as const) {
        if (wp[flag] !== undefined && typeof wp[flag] !== 'boolean') {
          fail(`${flag} 는 true/false 값이어야 해요.`);
        }
      }
    }
  }
}
