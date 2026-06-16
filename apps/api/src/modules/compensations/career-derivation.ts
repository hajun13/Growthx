/**
 * 보상 현황 표(2026 연봉갱신 Index 시트) 경력/연봉 파생 계산.
 * 순수 함수 — buildSimulation 비대화 방지를 위해 분리. 저장 안 함(표시 전용).
 */

/** 보상 표 산정에 쓰이는 User 경력/연봉 입력(모두 nullable). */
export interface CareerRosterInput {
  hireDate: Date | null;
  priorCareerMonths: number | null;
  careerBaseMonths: number | null;
  careerPosition: string | null;
  serviceYears: number | null;
  considerationExclusion: string | null;
  currentSalary: number | null;
  currentSalaryExclTransfer: number | null;
}

/** buildSimulation 행에 합쳐지는 경력/연봉 파생 결과. */
export interface CareerRosterDerived {
  hireDate: string | null;
  tenureMonths: number | null;
  careerBaseMonths: number | null;
  priorCareerMonths: number | null;
  totalCareerMonths: number | null;
  totalCareerLabel: string | null;
  careerPosition: string | null;
  serviceYears: number | null;
  considerationExclusion: string | null;
  currentSalaryExclTransfer: number | null;
  salaryDiffBA: number | null;
}

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30;

/**
 * 파생 기준일 = 사이클 연도말(deterministic). year 없으면 서버 현재.
 * 근속력은 연중 어느 날 조회해도 같도록 연도말로 고정.
 */
export function rosterBaseDate(cycleYear: number | null): Date {
  return cycleYear != null ? new Date(Date.UTC(cycleYear, 11, 31)) : new Date();
}

/** 근속력(월) = round((기준일 − hireDate)/30일). hireDate 없으면 null. */
export function tenureMonthsOf(hireDate: Date | null, baseDate: Date): number | null {
  if (!hireDate) return null;
  return Math.round((baseDate.getTime() - hireDate.getTime()) / MS_PER_MONTH);
}

/** 총경력(연월) 라벨 "N년 M개월". months null이면 null. */
export function totalCareerLabelOf(months: number | null): string | null {
  if (months == null) return null;
  const m = Math.floor(months);
  return `${Math.floor(m / 12)}년 ${m % 12}개월`;
}

/**
 * 경력/연봉 컬럼 파생.
 *  - totalCareerMonths: hireDate 있으면 tenure+(prior??0), 없고 prior만 있으면 prior, 둘 다 없으면 null.
 *  - salaryDiffBA: currentSalary − (currentSalaryExclTransfer ?? currentSalary). 둘 다 없으면 null, A없으면 0.
 */
export function deriveCareerRoster(
  u: CareerRosterInput,
  baseDate: Date,
): CareerRosterDerived {
  const tenureMonths = tenureMonthsOf(u.hireDate, baseDate);

  let totalCareerMonths: number | null;
  if (u.hireDate) {
    totalCareerMonths = (tenureMonths ?? 0) + (u.priorCareerMonths ?? 0);
  } else if (u.priorCareerMonths != null) {
    totalCareerMonths = u.priorCareerMonths;
  } else {
    totalCareerMonths = null;
  }

  const salaryDiffBA =
    u.currentSalary != null
      ? Math.round(u.currentSalary) - (u.currentSalaryExclTransfer ?? Math.round(u.currentSalary))
      : null;

  return {
    hireDate: u.hireDate ? u.hireDate.toISOString() : null,
    tenureMonths,
    careerBaseMonths: u.careerBaseMonths,
    priorCareerMonths: u.priorCareerMonths,
    totalCareerMonths,
    totalCareerLabel: totalCareerLabelOf(totalCareerMonths),
    careerPosition: u.careerPosition,
    serviceYears: u.serviceYears,
    considerationExclusion: u.considerationExclusion,
    currentSalaryExclTransfer: u.currentSalaryExclTransfer,
    salaryDiffBA,
  };
}
