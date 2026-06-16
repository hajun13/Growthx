/**
 * 연도별 평가등급: 직전 사이클 등급 파생.
 * compensations.service 비대화 방지를 위해 분리한 순수 파생 헬퍼(access.util 처럼 prisma 를 인자로 받음).
 */
import { Grade } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** 평가등급제 도입연도. 2025부터 평가등급제 도입 — 2024 이하 사이클에는 등급이 없다(previousGrade=null). */
export const GRADE_SYSTEM_START_YEAR = 2025;

/**
 * 직전 사이클(year<currentCycleYear 중 최대 year) 1개를 찾고, 그 사이클 EvaluationResult 를
 * userId→finalGrade 맵으로 일괄 조회(1회 findMany, N+1 금지).
 * 직전 사이클이 없으면 { previousCycleYear:null, gradeByUser:비어있는 맵 }.
 * @param userIds null 이면 직전 사이클 전체 결과 조회(단건/소규모용). 배열이면 해당 user 한정.
 */
export async function derivePreviousCycleGrades(
  prisma: PrismaService,
  currentCycleYear: number | null,
  userIds: string[] | null,
): Promise<{ previousCycleYear: number | null; gradeByUser: Map<string, Grade | null> }> {
  const gradeByUser = new Map<string, Grade | null>();
  if (currentCycleYear == null) return { previousCycleYear: null, gradeByUser };

  const prior = await prisma.evaluationCycle.findFirst({
    where: { year: { lt: currentCycleYear } },
    orderBy: { year: 'desc' },
    select: { id: true, year: true },
  });
  if (!prior) return { previousCycleYear: null, gradeByUser };

  const results = await prisma.evaluationResult.findMany({
    where: {
      cycleId: prior.id,
      ...(userIds ? { userId: { in: userIds } } : {}),
    },
    select: { userId: true, finalGrade: true },
  });
  for (const r of results) gradeByUser.set(r.userId, r.finalGrade ?? null);
  return { previousCycleYear: prior.year, gradeByUser };
}

/**
 * 등급제 도입연도 게이팅: 직전 사이클 연도가 도입연도(2025) 이전이면 그 해엔 등급이 없으므로 null.
 * 도입 후면 직전 사이클 finalGrade(없으면 null) 그대로.
 */
export function gatePreviousGrade(
  previousCycleYear: number | null,
  grade: Grade | null | undefined,
): Grade | null {
  if (previousCycleYear != null && previousCycleYear < GRADE_SYSTEM_START_YEAR) return null;
  return grade ?? null;
}
