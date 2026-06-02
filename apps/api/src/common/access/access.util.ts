import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../decorators/current-user';

/**
 * 행 수준(소유권) 권한 헬퍼.
 * 본인/팀/본부 한정 규칙(business-rules §9, 계약 §12)을 service 에서 강제한다.
 */

/** target 사용자가 현재 사용자의 가시 범위에 있는지(전사/본부/팀/본인). */
export async function canViewUser(
  prisma: PrismaService,
  current: AuthUser,
  targetUserId: string,
): Promise<boolean> {
  if (current.role === Role.hr_admin) return true;
  if (current.id === targetUserId) return true;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { department: true },
  });
  if (!target) return false;

  if (current.role === Role.team_lead) {
    // 직접 보고자이거나 같은 팀(부서)
    if (target.managerId === current.id) return true;
    if (current.departmentId && target.departmentId === current.departmentId) return true;
    return false;
  }

  if (current.role === Role.division_head) {
    // 대상의 부서가 현재 본부 하위 트리에 속하는지
    return isDepartmentUnder(prisma, target.departmentId, current.departmentId);
  }

  return false;
}

/** childDeptId 가 ancestorDeptId 의 하위(또는 동일)인지 트리 상향 탐색. */
export async function isDepartmentUnder(
  prisma: PrismaService,
  childDeptId: string | null,
  ancestorDeptId: string | null,
): Promise<boolean> {
  if (!childDeptId || !ancestorDeptId) return false;
  let cursor: string | null = childDeptId;
  // 안전 가드: 트리 깊이 상한
  for (let i = 0; i < 10 && cursor; i++) {
    if (cursor === ancestorDeptId) return true;
    const dept = await prisma.department.findUnique({ where: { id: cursor } });
    cursor = dept?.parentId ?? null;
  }
  return false;
}
