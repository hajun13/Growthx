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

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 파생 기준일 = min(오늘, 사이클 연도말).
 *  - 진행 중(올해·미래) 사이클 → 오늘. 아직 오지 않은 미래 근속을 세지 않는다
 *    (이전 구현은 연도말 고정이라 2025-12-09 입사자가 2026 주기에서 12개월로 표시됐다).
 *  - 지난 사이클 → 그 해 12/31(KST) 로 고정. 종료된 연도의 표는 언제 열어도 같은 값.
 */
export function rosterBaseDate(cycleYear: number | null): Date {
  const now = new Date();
  if (cycleYear == null) return now;
  // KST 12/31 23:59:59.999 = UTC 12/31 14:59:59.999 (그 해 마지막 날을 온전히 포함).
  const yearEnd = new Date(Date.UTC(cycleYear, 11, 31, 14, 59, 59, 999));
  return yearEnd.getTime() < now.getTime() ? yearEnd : now;
}

/** UTC 저장 시각을 KST 달력일(연·월·일 + 그 달 말일)로 환산. 컨테이너 TZ 는 UTC. */
function kstCalendarParts(date: Date): { year: number; month: number; day: number; lastDay: number } {
  const k = new Date(date.getTime() + KST_OFFSET_MS);
  const year = k.getUTCFullYear();
  const month = k.getUTCMonth();
  return {
    year,
    month,
    day: k.getUTCDate(),
    lastDay: new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  };
}

/**
 * 근속력(월) = 입사일부터 기준일까지 **채운 달력 개월수**.
 * 이전 구현은 30일=1개월 근사 + 반올림이라 장기 근속일수록 실제보다 부풀었다
 * (2007-09-01 입사 → 231개월인데 235로 표시). 달력 월 차이로 세고 일자가 모자라면 내림,
 * 단 기준일이 그 달 말일이면 채운 것으로 인정(1/31 입사 → 2/28 = 1개월).
 * 입사 예정(미래 입사일)이면 0. hireDate 없으면 null.
 */
export function tenureMonthsOf(hireDate: Date | null, baseDate: Date): number | null {
  if (!hireDate) return null;
  const from = kstCalendarParts(hireDate);
  const to = kstCalendarParts(baseDate);
  let months = (to.year - from.year) * 12 + (to.month - from.month);
  if (to.day < from.day && to.day !== to.lastDay) months -= 1;
  return Math.max(0, months);
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
