/**
 * 연봉 이월(체이닝) 파생.
 *
 * 연봉은 사이클을 따라 이월된다:
 *   금년도 연봉(Y) = 금년도 연봉(Y-1) × (1 + 인상률(Y-1)/100) + 조정분(Y-1)
 *   전년도 연봉(Y) = 금년도 연봉(Y-1)
 *
 * 즉 어떤 사이클의 "제안연봉"(= 금년도 연봉 + 인상 + 조정분)이 다음 사이클의 "금년도 연봉"이 된다.
 *
 *  - 인상률은 2026년 사이클부터 연봉 계산에 반영(SALARY_CALCULATION_START_YEAR).
 *    그 이전 사이클은 인상분이 조정분(연봉갱신 엑셀 X열)에 이미 포함되어 있어 인상률 0%로 둔다.
 *  - 앵커(가장 이른 사이클의 금년도/전년도 연봉) = User.currentSalary / User.previousSalary.
 *    수기 전년도(previousSalary)는 실데이터(Compensation·조정분)가 있는 "진짜 이월" 스텝에서만
 *    직전 금년도 값으로 대체된다 — 데이터 없는 스텝이 수기 값을 덮어쓰거나(사장),
 *    전년도=금년도를 지어내지 않는다(buildSalaryChain 앵커링 주석 참고).
 *  - 같은 연도에 사이클이 여러 개면 연도당 1개만 이월에 사용하되, 생성 순서(uuid)가 아니라
 *    FINAL > closed > Compensation 행 보유 > id 순으로 권위 사이클을 선택(pickAuthoritativeCyclePerYear).
 *  - Compensation.baseSalary·nextYearSalary 스냅샷은 **읽지 않는다**.
 *    조정분을 수정하면 다음 사이클 금년도 연봉이 즉시 따라와야 하므로 매 조회마다 재계산한다.
 *    (인상률만 Compensation.raiseRate 스냅샷에서 읽는다 — 확정 등급·그룹 tier 가 반영된 산정 결과.)
 *
 * compensations.service 비대화 방지를 위해 분리한 파생 헬퍼(access.util 처럼 prisma 를 인자로 받음).
 */
import { CycleStatus, CycleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { appliesRuleBasedSalaryCalculation } from './simulation.builder';

export type PrevSalarySource = 'derived' | 'carryover' | 'manual' | 'none';

/** 파생된 전년도 연봉(value)과 출처(source). */
export interface PrevSalary {
  value: number | null;
  source: PrevSalarySource;
}

/** 조회 사이클 기준으로 이월 계산된 금년도/전년도 연봉. */
export interface SalaryChain {
  /** 조회 사이클의 금년도 연봉 = 직전 사이클의 제안연봉(조정분 포함). */
  currentSalary: number | null;
  /** 조회 사이클의 전년도 연봉 = 직전 사이클의 금년도 연봉. */
  previous: PrevSalary;
}

/** 체인 시작점(가장 이른 사이클 시점의 연봉). User 수기 입력값. */
export interface ChainAnchor {
  currentSalary: number | null;
  previousSalary: number | null;
}

interface CycleStep {
  id: string;
  year: number;
}

const EMPTY_CHAIN: SalaryChain = {
  currentSalary: null,
  previous: { value: null, source: 'none' },
};

/**
 * 직전 사이클들을 순서대로 밟아 금년도·전년도 연봉을 산출(순수 함수).
 *
 * 앵커링: previous 는 수기 전년도(User.previousSalary)로 시작해, 그 스텝에 실데이터
 * (Compensation 인상률 스냅샷 또는 조정분)가 있는 "진짜 이월" 스텝에서만 직전 금년도(base)로
 * 전진한다. 데이터가 전혀 없는 스텝은 no-op —
 *  - 수기 전년도를 조용히 버리지 않는다(이전엔 첫 스텝이 무조건 base 로 덮어써 수기 값이 사장).
 *  - 이월 근거 없이 '전년도=금년도' 를 지어내지 않는다(근거 없으면 이전 previous 유지).
 *  - base=null(금년도 앵커 미입력)이어도 수기 previous 를 'none' 으로 강등하지 않는다.
 * 실데이터 스텝의 복리 이월식 round(base×(1+rate/100))+adj 은 검증된 그대로다.
 * (데이터 없는 스텝은 rate=0·adj=0 이라 base 도 원래 불변 — currentSalary 결과는 이전과 동일.)
 *
 * @param steps  year < currentCycleYear 인 사이클, 연도 오름차순(연도별 1개로 중복 제거된 상태).
 */
export function buildSalaryChain(
  steps: CycleStep[],
  anchor: ChainAnchor,
  raiseRateByCycle: Map<string, number>,
  adjustmentByCycle: Map<string, number>,
): SalaryChain {
  let base = anchor.currentSalary != null ? Math.round(anchor.currentSalary) : null;
  let previous: PrevSalary =
    anchor.previousSalary != null
      ? { value: Math.round(anchor.previousSalary), source: 'manual' }
      : { value: null, source: 'none' };

  for (const step of steps) {
    // 이 스텝에 실제 보상 데이터가 있어야 진짜 이월 스텝. 없으면 base·previous 모두 불변.
    const hasData = raiseRateByCycle.has(step.id) || adjustmentByCycle.has(step.id);
    if (base == null || !hasData) continue;
    // 직전 사이클의 금년도 연봉이 곧 이번 사이클의 전년도 연봉(진짜 이월 스텝에서만 전진).
    previous = { value: base, source: 'derived' };
    const rate = appliesRuleBasedSalaryCalculation(step.year)
      ? raiseRateByCycle.get(step.id) ?? 0
      : 0;
    base = Math.round(base * (1 + rate / 100)) + (adjustmentByCycle.get(step.id) ?? 0);
  }
  return { currentSalary: base, previous };
}

/** 연도 중복 사이클에서 권위 사이클 선정용 후보(pickAuthoritativeCyclePerYear 입력). */
export interface CycleCandidate {
  id: string;
  year: number;
  cycleType: CycleType;
  status: CycleStatus;
}

/**
 * 같은 연도에 사이클이 여러 개면 이월이 중복 적용되므로 연도당 1개만 남긴다(순수 함수).
 * 생성 순서(uuid)가 아니라 그 연도의 "권위" 사이클을 선택:
 *   ① cycleType=FINAL(최종평가 — 인상·조정분 이월의 근거) 우선
 *   ② status=closed(마감 확정) 우선
 *   ③ 대상 사용자들의 Compensation 행이 실제 있는 사이클 우선
 *   ④ 그래도 같으면 id 오름차순(결정적).
 * (MIDTERM 사이클이 uuid 순서로 이겨 그 해 FINAL 의 인상·조정분이 누락되던 결함 수정.)
 */
export function pickAuthoritativeCyclePerYear(
  cycles: CycleCandidate[],
  cycleIdsWithComps: ReadonlySet<string>,
): CycleStep[] {
  const byYear = new Map<number, CycleCandidate[]>();
  for (const c of cycles) {
    const arr = byYear.get(c.year) ?? [];
    arr.push(c);
    byYear.set(c.year, arr);
  }
  // 비트 가중치로 ①>②>③ 사전식 우선순위(낮을수록 권위).
  const rank = (c: CycleCandidate): number =>
    (c.cycleType === CycleType.FINAL ? 0 : 4) +
    (c.status === CycleStatus.closed ? 0 : 2) +
    (cycleIdsWithComps.has(c.id) ? 0 : 1);
  const out: CycleStep[] = [];
  for (const [year, arr] of byYear) {
    const best = [...arr].sort(
      (a, b) => rank(a) - rank(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )[0];
    out.push({ id: best.id, year });
  }
  return out.sort((a, b) => a.year - b.year);
}

/** 조회 사이클 이전 사이클들을 연도 오름차순으로(연도당 권위 사이클 1개) 조회. */
async function priorCycleSteps(
  prisma: PrismaService,
  currentCycleYear: number,
  userIds: string[],
): Promise<CycleStep[]> {
  const cycles = await prisma.evaluationCycle.findMany({
    where: { year: { lt: currentCycleYear } },
    orderBy: [{ year: 'asc' }, { id: 'asc' }],
    select: { id: true, year: true, cycleType: true, status: true },
  });
  // 연도 중복이 있을 때만 ③(Compensation 행 존재) 판정 쿼리를 1회 추가 수행.
  const yearCount = new Map<number, number>();
  for (const c of cycles) yearCount.set(c.year, (yearCount.get(c.year) ?? 0) + 1);
  const dupIds = cycles.filter((c) => (yearCount.get(c.year) ?? 0) > 1).map((c) => c.id);
  let withComps: ReadonlySet<string> = new Set<string>();
  if (dupIds.length && userIds.length) {
    const rows = await prisma.compensation.findMany({
      where: { cycleId: { in: dupIds }, simulated: false, userId: { in: userIds } },
      select: { cycleId: true },
      distinct: ['cycleId'],
    });
    withComps = new Set(rows.map((r) => r.cycleId));
  }
  return pickAuthoritativeCyclePerYear(cycles, withComps);
}

/**
 * 다수 user 의 연봉 체인을 일괄 파생(N+1 방지).
 * 직전 사이클 목록 1회 + 그 사이클들의 Compensation·CompensationAdjustment 각 1회 조회
 * (연도 중복 사이클이 있으면 권위 판정용 Compensation 존재 조회 1회 추가).
 * @param anchors userId → 체인 시작 연봉(User.currentSalary / User.previousSalary).
 */
export async function deriveSalaryChains(
  prisma: PrismaService,
  userIds: string[],
  currentCycleYear: number | null,
  anchors: Map<string, ChainAnchor>,
): Promise<Map<string, SalaryChain>> {
  const out = new Map<string, SalaryChain>();
  if (!userIds.length) return out;

  const anchorOf = (uid: string): ChainAnchor =>
    anchors.get(uid) ?? { currentSalary: null, previousSalary: null };

  const steps =
    currentCycleYear != null ? await priorCycleSteps(prisma, currentCycleYear, userIds) : [];
  if (!steps.length) {
    for (const uid of userIds) {
      out.set(uid, buildSalaryChain([], anchorOf(uid), new Map(), new Map()));
    }
    return out;
  }

  const cycleIds = steps.map((s) => s.id);
  const [comps, adjs] = await Promise.all([
    prisma.compensation.findMany({
      where: { userId: { in: userIds }, simulated: false, cycleId: { in: cycleIds } },
      select: { userId: true, cycleId: true, raiseRate: true },
    }),
    prisma.compensationAdjustment.findMany({
      where: { userId: { in: userIds }, cycleId: { in: cycleIds } },
      select: { userId: true, cycleId: true, adjustmentAmount: true },
    }),
  ]);

  const rateByUser = new Map<string, Map<string, number>>();
  for (const c of comps) {
    const m = rateByUser.get(c.userId) ?? new Map<string, number>();
    m.set(c.cycleId, c.raiseRate);
    rateByUser.set(c.userId, m);
  }
  const adjByUser = new Map<string, Map<string, number>>();
  for (const a of adjs) {
    if (a.adjustmentAmount == null) continue;
    const m = adjByUser.get(a.userId) ?? new Map<string, number>();
    m.set(a.cycleId, a.adjustmentAmount);
    adjByUser.set(a.userId, m);
  }

  const noRates = new Map<string, number>();
  for (const uid of userIds) {
    out.set(
      uid,
      buildSalaryChain(
        steps,
        anchorOf(uid),
        rateByUser.get(uid) ?? noRates,
        adjByUser.get(uid) ?? noRates,
      ),
    );
  }
  return out;
}

/** 단일 user 의 연봉 체인(simulation 단건·compute 단건용). */
export async function deriveSalaryChain(
  prisma: PrismaService,
  userId: string,
  currentCycleYear: number | null,
  anchor: ChainAnchor,
): Promise<SalaryChain> {
  const map = await deriveSalaryChains(prisma, [userId], currentCycleYear, new Map([[userId, anchor]]));
  return map.get(userId) ?? EMPTY_CHAIN;
}
