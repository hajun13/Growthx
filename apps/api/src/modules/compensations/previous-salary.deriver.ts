/**
 * YoY2: 전년도 연봉 자동 파생.
 * 직전 사이클(year<현재 중 최대, simulated=false Compensation 존재)의 baseSalary →
 * nextYearSalary(이월) → User.previousSalary(수기 fallback) → null 우선순위로 결정.
 * compensations.service 비대화 방지를 위해 분리한 순수 파생 헬퍼(access.util 처럼 prisma 를 인자로 받음).
 */
import { PrismaService } from '../../prisma/prisma.service';

/** 파생된 전년도 연봉(value)과 출처(source). */
export interface PrevSalary {
  value: number | null;
  source: 'derived' | 'carryover' | 'manual' | 'none';
}

/**
 * 직전 사이클 Compensation(없으면 null) + 수기 fallback 으로 전년도 연봉을 결정.
 * derivePreviousSalary(단건) 와 deriveTeamPrevSalaryMap(일괄)이 공유하는 우선순위 로직.
 */
export function resolvePrevSalary(
  prior: { baseSalary: number | null; nextYearSalary: number | null } | null,
  manualFallback: number | null | undefined,
): PrevSalary {
  if (prior?.baseSalary != null) return { value: prior.baseSalary, source: 'derived' };
  if (prior?.nextYearSalary != null) return { value: prior.nextYearSalary, source: 'carryover' };
  if (manualFallback != null) return { value: Math.round(manualFallback), source: 'manual' };
  return { value: null, source: 'none' };
}

/**
 * 단일 user 의 전년도 연봉을 직전 사이클 누적 기록에서 파생.
 * 우선순위: 직전 사이클(simulated=false Compensation 존재 & year<현재) 의 baseSalary →
 *           그 Compensation 의 nextYearSalary(이월) → User.previousSalary(수기 fallback) → null.
 * @param currentCycleYear 현재(조회 대상) 사이클 연도. 그보다 작은 최대 year 사이클을 직전으로 본다.
 */
export async function derivePreviousSalary(
  prisma: PrismaService,
  userId: string,
  currentCycleYear: number,
  manualFallback: number | null | undefined,
): Promise<PrevSalary> {
  const prior = await prisma.compensation.findFirst({
    where: {
      userId,
      simulated: false,
      cycle: { year: { lt: currentCycleYear } },
    },
    orderBy: { cycle: { year: 'desc' } },
    select: { baseSalary: true, nextYearSalary: true },
  });
  return resolvePrevSalary(prior, manualFallback);
}

/**
 * 다수 user 의 전년도 연봉을 일괄 파생(N+1 방지).
 * 직전 사이클 1회 탐색(year<현재 중 최대, simulated=false Compensation 존재) → 그 사이클 Compensation 일괄 조회 → userId 맵.
 * 직전 사이클이 여럿(서로 다른 user 가 다른 직전 사이클을 가질 수 있음)일 수 있으므로 user별 최신 직전 Compensation 을 한 번에 조회.
 * @returns userId → PrevSalary 맵.
 */
export async function deriveTeamPrevSalaryMap(
  prisma: PrismaService,
  userIds: string[],
  currentCycleYear: number,
  manualByUser: Map<string, number | null | undefined>,
): Promise<Map<string, PrevSalary>> {
  const map = new Map<string, PrevSalary>();
  if (!userIds.length) return map;

  // user별 직전(year<현재) simulated=false Compensation 을 한 번에 조회(연도 내림차순) → 첫 행만 채택.
  const priors = await prisma.compensation.findMany({
    where: {
      userId: { in: userIds },
      simulated: false,
      cycle: { year: { lt: currentCycleYear } },
    },
    orderBy: { cycle: { year: 'desc' } },
    select: { userId: true, baseSalary: true, nextYearSalary: true },
  });
  const priorByUser = new Map<string, { baseSalary: number | null; nextYearSalary: number | null }>();
  for (const p of priors) {
    if (!priorByUser.has(p.userId)) {
      priorByUser.set(p.userId, { baseSalary: p.baseSalary, nextYearSalary: p.nextYearSalary });
    }
  }
  for (const uid of userIds) {
    map.set(uid, resolvePrevSalary(priorByUser.get(uid) ?? null, manualByUser.get(uid)));
  }
  return map;
}
