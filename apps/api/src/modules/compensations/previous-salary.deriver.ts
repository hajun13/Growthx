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
 *  - Compensation.baseSalary·nextYearSalary 스냅샷은 **읽지 않는다**.
 *    조정분을 수정하면 다음 사이클 금년도 연봉이 즉시 따라와야 하므로 매 조회마다 재계산한다.
 *    (인상률만 Compensation.raiseRate 스냅샷에서 읽는다 — 확정 등급·그룹 tier 가 반영된 산정 결과.)
 *
 * compensations.service 비대화 방지를 위해 분리한 파생 헬퍼(access.util 처럼 prisma 를 인자로 받음).
 */
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
    // 직전 사이클의 금년도 연봉이 곧 이번 사이클의 전년도 연봉.
    previous = base != null ? { value: base, source: 'derived' } : { value: null, source: 'none' };
    if (base == null) continue;
    const rate = appliesRuleBasedSalaryCalculation(step.year)
      ? raiseRateByCycle.get(step.id) ?? 0
      : 0;
    base = Math.round(base * (1 + rate / 100)) + (adjustmentByCycle.get(step.id) ?? 0);
  }
  return { currentSalary: base, previous };
}

/** 조회 사이클 이전 사이클들을 연도 오름차순으로(연도당 1개) 조회. */
async function priorCycleSteps(
  prisma: PrismaService,
  currentCycleYear: number,
): Promise<CycleStep[]> {
  const cycles = await prisma.evaluationCycle.findMany({
    where: { year: { lt: currentCycleYear } },
    orderBy: [{ year: 'asc' }, { id: 'asc' }],
    select: { id: true, year: true },
  });
  // 같은 연도에 사이클이 여러 개면 이월이 중복 적용되므로 연도당 1개만 사용.
  const byYear = new Map<number, CycleStep>();
  for (const c of cycles) if (!byYear.has(c.year)) byYear.set(c.year, c);
  return [...byYear.values()];
}

/**
 * 다수 user 의 연봉 체인을 일괄 파생(N+1 방지).
 * 직전 사이클 목록 1회 + 그 사이클들의 Compensation·CompensationAdjustment 각 1회 조회.
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

  const steps = currentCycleYear != null ? await priorCycleSteps(prisma, currentCycleYear) : [];
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
