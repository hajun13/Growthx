/**
 * 연봉 시뮬레이션 행 빌드 + 인상률/그룹 tier 보너스 파생 계산.
 * compensations.service 비대화 방지를 위해 분리한 순수 헬퍼(career-derivation 분리 패턴).
 * 점수 규칙은 ScoringService 인스턴스를 인자로 주입받아 사용(DB 접근 없음).
 */
import { DepartmentType, Grade, GroupTier } from '@prisma/client';
import { ScoringService } from '../../common/rules/scoring.service';
import { AdjustmentValues } from './compensation-adjustment.service';
import { CareerRosterInput, deriveCareerRoster } from './career-derivation';

/** groupTierBonus 미설정 시 기본값(business-rules §5, 2026 seed). */
export const DEFAULT_GROUP_TIER_BONUS: Record<'excellent' | 'standard' | 'poor', number> = {
  excellent: 2,
  standard: 0,
  poor: -1,
};

/**
 * 최종 적용 인상률 하한 0%(음수 보너스로 연봉 삭감 방지).
 * grade 인상률 + tierBonus 합산값이 음수면 0으로 클램프. 표시용 groupTierBonus 자체는 음수 유지.
 */
export function clampRaiseRate(rate: number): number {
  return Math.max(0, rate);
}

/** 2026년부터 평가 등급 기반 연봉 인상률을 실제 연봉 계산에 적용한다. */
export const SALARY_CALCULATION_START_YEAR = 2026;

export function appliesRuleBasedSalaryCalculation(cycleYear: number | null): boolean {
  return cycleYear == null || cycleYear >= SALARY_CALCULATION_START_YEAR;
}

/** weightPolicy 에서 groupTierBonus 맵을 읽는다(미설정 시 기본값). */
export function groupTierBonusMap(weightPolicy: unknown): Record<string, number> {
  const wp = weightPolicy as { groupTierBonus?: Record<string, number> } | null;
  return { ...DEFAULT_GROUP_TIER_BONUS, ...(wp?.groupTierBonus ?? {}) };
}

/**
 * 부서(department)로부터 본부(division) 이름을 도출.
 * type='division' → 자신의 name; type='team' → 부모가 division 이면 부모 name;
 * 그 외(group 직속·부모가 group)면 null.
 */
export function divisionNameOf(
  dept:
    | { name: string; type: DepartmentType; parent?: { name: string; type: DepartmentType } | null }
    | null
    | undefined,
): string | null {
  if (!dept) return null;
  if (dept.type === DepartmentType.division) return dept.name;
  if (dept.type === DepartmentType.team) {
    return dept.parent?.type === DepartmentType.division ? dept.parent.name : null;
  }
  return null;
}

/** 부서가 팀(team)이면 팀 이름, 아니면 null. */
export function teamNameOf(
  dept: { name: string; type: DepartmentType } | null | undefined,
): string | null {
  return dept?.type === DepartmentType.team ? dept.name : null;
}

/**
 * Prisma user(전체 스칼라 포함) → 보상 표 경력/연봉 입력으로 추출.
 * findUnique/findMany 모두 기본 전체 스칼라 반환이므로 select 없이 안전.
 */
export function careerInputOf(
  u:
    | {
        hireDate?: Date | null;
        priorCareerMonths?: number | null;
        careerBaseMonths?: number | null;
        careerPosition?: string | null;
        serviceYears?: number | null;
        considerationExclusion?: string | null;
        currentSalaryExclTransfer?: number | null;
      }
    | null
    | undefined,
): Omit<CareerRosterInput, 'currentSalary'> {
  return {
    hireDate: u?.hireDate ?? null,
    priorCareerMonths: u?.priorCareerMonths ?? null,
    careerBaseMonths: u?.careerBaseMonths ?? null,
    careerPosition: u?.careerPosition ?? null,
    serviceYears: u?.serviceYears ?? null,
    considerationExclusion: u?.considerationExclusion ?? null,
    currentSalaryExclTransfer: u?.currentSalaryExclTransfer ?? null,
  };
}

/**
 * 등급 → 인상률(+그룹 tier 보너스) → 예상 연봉 + 등급별 비교 슬라이더 데이터.
 * @param scoring    등급별 인상률 조회(raiseRateForGrade)에 사용하는 ScoringService 인스턴스.
 * @param tierBonus  그룹 실적 tier 보너스(%). 모든 raiseRate·projectedSalary 에 가산.
 * @param groupTier  표시용 그룹 tier(없으면 null).
 */
export function buildSimulation(
  scoring: ScoringService,
  cycleId: string,
  u: {
    id: string;
    name: string | null;
    departmentName: string | null;
    currentSalary: number | null;
    currentGrade: Grade | null;
    position: string | null;
    previousSalary: number | null;
    previousSalarySource: 'derived' | 'carryover' | 'manual' | 'none';
    previousGrade: Grade | null;
    previousCycleYear: number | null;
    divisionName: string | null;
    teamName: string | null;
  } & CareerRosterInput,
  raiseRates: Record<Grade, number>,
  tierBonus: number,
  groupTier: GroupTier | null,
  adjustment: AdjustmentValues,
  baseDate: Date,
  currentCycleYear: number | null,
) {
  const grades: Grade[] = [Grade.S, Grade.A, Grade.B, Grade.C, Grade.D];
  const shouldApplyRaise = appliesRuleBasedSalaryCalculation(currentCycleYear);
  // 인상률 하한 0%(음수 보너스로 연봉 삭감 방지). 표시용 groupTierBonus 는 음수 유지하되 적용 인상률은 클램프.
  const rateForGrade = (grade: Grade): number =>
    clampRaiseRate(scoring.raiseRateForGrade(grade, raiseRates) + tierBonus);
  const baseRateForGrade = (grade: Grade): number =>
    scoring.raiseRateForGrade(grade, raiseRates);
  const project = (grade: Grade): number | null => {
    if (u.currentSalary == null) return null;
    if (!shouldApplyRaise) return Math.round(u.currentSalary);
    return Math.round(u.currentSalary * (1 + rateForGrade(grade) / 100));
  };
  const raiseRate = shouldApplyRaise && u.currentGrade != null ? rateForGrade(u.currentGrade) : null;
  const projectedSalary = u.currentGrade != null ? project(u.currentGrade) : null;

  // 2026년부터: 제안연봉 = 금년도 연봉 * 등급 인상률 + 조정분.
  // 2026년 이전 누적 데이터: 제안연봉 = 금년도 연봉 + 조정분(등급 기반 계산 미적용).
  const salaryBeforeAdjustment = shouldApplyRaise
    ? projectedSalary
    : u.currentSalary != null
      ? Math.round(u.currentSalary)
      : null;
  const finalProjectedSalary = salaryBeforeAdjustment != null
    ? salaryBeforeAdjustment + (adjustment.adjustmentAmount ?? 0)
    : null;
  const finalRaiseRate =
    u.currentSalary != null && finalProjectedSalary != null
      ? Math.round((finalProjectedSalary / u.currentSalary - 1) * 1000) / 10
      : null;
  const careerRoster = deriveCareerRoster(u, baseDate);

  return {
    userId: u.id,
    userName: u.name,
    departmentName: u.departmentName,
    cycleId,
    currentSalary: u.currentSalary,
    currentGrade: u.currentGrade,
    // 연도별 평가등급: 조회 사이클 연도(currentCycleYear) — currentGrade 의 연도 라벨.
    currentCycleYear,
    raiseRate,
    projectedSalary,
    position: u.position,
    previousSalary: u.previousSalary,
    previousSalarySource: u.previousSalarySource,
    // 연도별 평가등급: 직전 사이클 등급(도입연도 게이팅)·연도.
    previousGrade: u.previousGrade,
    previousCycleYear: u.previousCycleYear,
    divisionName: u.divisionName,
    teamName: u.teamName,
    groupTier,
    groupTierBonus: tierBonus,
    baseByGrade: grades.map((grade) => ({
      grade,
      raiseRate: shouldApplyRaise ? baseRateForGrade(grade) : 0,
      projectedSalary:
        u.currentSalary == null
          ? null
          : shouldApplyRaise
            ? Math.round(u.currentSalary * (1 + baseRateForGrade(grade) / 100))
            : Math.round(u.currentSalary),
    })),
    byGrade: grades.map((grade) => ({
      grade,
      raiseRate: shouldApplyRaise ? rateForGrade(grade) : 0,
      projectedSalary: project(grade),
    })),
    // 보상 수기 조정(엑셀 T~AC) 병합 + 파생.
    adjustmentAmount: adjustment.adjustmentAmount,
    promotionPositionCode: adjustment.promotionPositionCode,
    incentiveAmount: adjustment.incentiveAmount,
    note: adjustment.note,
    finalProjectedSalary,
    finalRaiseRate,
    // 보상 표(엑셀 K~AC) 경력/연봉 컬럼 파생(표시 전용).
    ...careerRoster,
    considerationExclusion:
      currentCycleYear === 2025 ? careerRoster.considerationExclusion : null,
  };
}
