import { Prisma } from '@prisma/client';

/**
 * 평가 대상 제외 규칙 — self 평가·다운워드 평가·중간점검 개시가 모두 같은 기준을 쓰도록
 * 한 곳에 모은다. 규칙이 여러 서비스에 흩어지면 한 곳만 고쳐 정합이 깨진다.
 *
 * 제외 기준(입사일):
 *  - `evaluationExempt = true` (수동 평가 제외 플래그) → 제외.
 *  - 주기에 `hireCutoffDate` 가 설정돼 있으면, **입사일이 기준일 이상(>=)이거나 미등록**이면 제외.
 *    즉 "기준일 포함" — 기준일 당일 입사자도 제외한다(이전 `>` 규칙은 당일 입사자를 놓쳤다).
 *    포함할 사람은 `hireDate < hireCutoffDate` 인 사람뿐이다.
 */

/**
 * 사용자 조회용 Prisma where 조각 — `evaluationExempt=false` + (기준일 있으면) `hireDate < cutoff`.
 * Prisma 의 `lt` 는 null 을 자동 제외하므로 입사일 미등록자도 함께 빠진다(포함 규칙 충족).
 */
export function evaluationExclusionWhere(
  hireCutoffDate: Date | null,
): Prisma.UserWhereInput {
  return {
    evaluationExempt: false,
    ...(hireCutoffDate != null ? { hireDate: { lt: hireCutoffDate } } : {}),
  };
}

/**
 * 입사일 기준 제외 판정(단건, in-memory) — self 평가 생성 게이트처럼 이미 로드한 사용자 하나를
 * 검사할 때 쓴다. 입사일 미등록이거나 기준일 이상(>=)이면 true(제외).
 * `hireCutoffDate` 가 없으면 입사일 기준 제외는 적용되지 않는다(false).
 */
export function isExcludedByHireCutoff(
  hireDate: Date | null | undefined,
  hireCutoffDate: Date | null | undefined,
): boolean {
  if (hireCutoffDate == null) return false;
  return !hireDate || hireDate >= hireCutoffDate;
}
