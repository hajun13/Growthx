import { PrismaService } from '../../prisma/prisma.service';
import { deptHeadUserId } from './access.util';

/**
 * 중간점검 전용 평가자 체인(2026-07-23).
 * 최종평가용 resolveDownwardEvaluators 와 **다르다** — 팀장은 평가자로 참여하지 않는다.
 *  - 1차 = 가장 가까운 상위 본부장 → 없으면 부그룹장 → 없으면 그룹대표 단독.
 *  - 2차 = 그룹대표.
 * 부서장 판정은 Department.headUserId 명시 지정만 사용한다(B-1).
 */
export interface MidtermChainInput {
  evaluateeId: string;
  divisionHeadId: string | null;
  deputyHeadId: string | null;
  groupHeadId: string | null;
}

export interface MidtermReviewers {
  firstReviewerId: string | null;
  finalReviewerId: string | null;
}

/** 순수 판정 — 수집된 계층별 장에서 1차·2차를 고른다. */
export function pickMidtermReviewers(input: MidtermChainInput): MidtermReviewers {
  const { evaluateeId, groupHeadId } = input;
  // 그룹대표 본인이거나 그룹대표가 없으면 중간점검 대상이 아니다.
  if (!groupHeadId || groupHeadId === evaluateeId) {
    return { firstReviewerId: null, finalReviewerId: null };
  }
  const notSelf = (id: string | null) => (id && id !== evaluateeId ? id : null);
  // 부그룹장이 그룹대표와 동일인이면 별도 1차 자리가 아니다.
  const deputy = notSelf(input.deputyHeadId) === groupHeadId ? null : notSelf(input.deputyHeadId);
  const first = notSelf(input.divisionHeadId) ?? deputy ?? groupHeadId;
  return { firstReviewerId: first, finalReviewerId: groupHeadId };
}

/** 부서 트리를 위로 올라가며 계층별 장을 수집한 뒤 pickMidtermReviewers 로 판정. */
export async function resolveMidtermReviewers(
  prisma: PrismaService,
  evaluateeId: string,
): Promise<MidtermReviewers> {
  const evaluatee = await prisma.user.findUnique({
    where: { id: evaluateeId },
    select: { departmentId: true },
  });
  if (!evaluatee?.departmentId) return { firstReviewerId: null, finalReviewerId: null };

  let divisionHeadId: string | null = null;
  let deputyHeadId: string | null = null;
  let groupHeadId: string | null = null;
  let groupSeen = false;

  let cursor: string | null = evaluatee.departmentId;
  for (let i = 0; i < 10 && cursor; i++) {
    const dept = await prisma.department.findUnique({
      where: { id: cursor },
      select: { id: true, type: true, parentId: true, headUserId: true, deputyHeadUserId: true },
    });
    if (!dept) break;
    const head = await deptHeadUserId(prisma, dept, evaluateeId);
    if (dept.type === 'division' && !divisionHeadId) divisionHeadId = head;
    if (dept.type === 'group' && !groupSeen) {
      groupSeen = true;
      groupHeadId =
        dept.headUserId === evaluateeId
          ? evaluateeId
          : await deptHeadUserId(prisma, dept, evaluateeId);
      if (dept.deputyHeadUserId) {
        const deputy = await prisma.user.findUnique({
          where: { id: dept.deputyHeadUserId },
          select: { isActive: true },
        });
        if (deputy?.isActive) deputyHeadId = dept.deputyHeadUserId;
      }
    }
    cursor = dept.parentId;
  }

  return pickMidtermReviewers({ evaluateeId, divisionHeadId, deputyHeadId, groupHeadId });
}
