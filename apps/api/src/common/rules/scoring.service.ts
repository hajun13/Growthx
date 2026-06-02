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

  /** cycle 의 RuleSet 을 파싱해 반환. 없으면 404. */
  async loadRuleSetForCycle(cycleId: string): Promise<ParsedRuleSet> {
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: cycleId },
      include: { ruleSet: true },
    });
    if (!cycle || !cycle.ruleSet) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '해당 주기의 규칙 세트를 찾을 수 없어요.',
      });
    }
    return this.parse(cycle.ruleSet);
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
    const band = gradeScale.find((b) => score >= b.min && score <= b.max);
    if (band) return band.grade;
    // 구간 밖(최저) → 가장 낮은 등급
    const sorted = [...gradeScale].sort((a, b) => a.min - b.min);
    return sorted[0]?.grade ?? Grade.D;
  }

  // ── §2 측정방식별 raw 등급 매핑 ──
  /**
   * 측정방식(measureType)에 따라 KPI raw 등급을 산출한다.
   * - amount/rate: 달성률(rate, %) → RuleSet.gradingScales 표.
   * - count: 건수(rate 자리에 actualValue) → KPI별 grading(CountGradeBand[]) 임계값.
   * - qualitative: 평가자가 직접 부여한 등급(directGrade) 사용.
   */
  measureToGrade(
    measureType: MeasureType,
    value: number | null,
    gradingScales: GradingScales,
    countGrading: CountGradeBand[] | null,
    directGrade: Grade | null,
  ): Grade {
    if (measureType === MeasureType.qualitative) {
      return directGrade ?? Grade.D;
    }
    if (measureType === MeasureType.count) {
      if (value == null || !countGrading?.length) return Grade.D;
      return this.countToGrade(value, countGrading);
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
  validateWeights(
    items: { weight: number; isQualitative: boolean }[],
    policy: WeightPolicy,
  ): void {
    const total = items.reduce((sum, i) => sum + (i.weight ?? 0), 0);
    if (total !== policy.totalMustEqual) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `가중치 합은 ${policy.totalMustEqual}이어야 해요. (현재 ${total})`,
      });
    }
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

  /** 그룹 실적 달성률 → tier 분류 (excellent/standard/poor). */
  achievementRateToTier(rate: number): GroupTier {
    if (rate >= 100) return GroupTier.excellent;
    if (rate >= 90) return GroupTier.standard;
    return GroupTier.poor;
  }

  // ── §5 인상률 ──
  raiseRateForGrade(grade: Grade, raiseRates: ParsedRuleSet['raiseRates']): number {
    return raiseRates[grade] ?? 0;
  }
}
