import { Prisma, Role, VisibilityScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../decorators/current-user';

/**
 * 행 수준(소유권·가시 범위) 권한 헬퍼.
 * M3 Item2: 기존 자동 트리 파생 → visibilityScope 기준으로 통일.
 *  - self      : 본인만
 *  - team      : 본인 팀(부서) 구성원
 *  - division  : 본인 본부 하위 전원(형제 본부 제외)
 *  - group     : 본인 그룹 하위 전원
 *  - company   : 전체
 * hr_admin 은 company 동등.
 * business-rules §9 + requirements-m3-items1-3 §4.
 */

/**
 * 현재 사용자가 볼 수 있는 부서 id 집합을 visibilityScope 기준으로 산정.
 * company → null(=제한 없음). 그 외 → 부서 id 배열.
 * self 는 부서가 아니라 본인 사용자 기준이므로 빈 배열 반환(호출부에서 본인 id 로 보정).
 */
export async function visibleDeptIds(
  prisma: PrismaService,
  current: AuthUser,
): Promise<string[] | null> {
  // hr_admin 또는 company scope → 전체
  if (current.role === Role.hr_admin || current.scope === VisibilityScope.company) {
    return null;
  }
  if (!current.departmentId) {
    // 소속 없는 사용자(대표이사 등)는 본인만(self 로 폴백) — 빈 집합.
    return [];
  }

  // 호출 스코프 지역 캐시: 동일 deptId 의 본부/그룹 루트 재조회를 막는다(요청 간 공유 X).
  const divCache = new Map<string, string>();
  const groupCache = new Map<string, string>();
  const cachedDivisionRootOf = async (deptId: string): Promise<string> => {
    const hit = divCache.get(deptId);
    if (hit !== undefined) return hit;
    const root = await divisionRootOf(prisma, deptId);
    divCache.set(deptId, root);
    return root;
  };
  const cachedGroupRootOf = async (deptId: string): Promise<string> => {
    const hit = groupCache.get(deptId);
    if (hit !== undefined) return hit;
    const root = await groupRootOf(prisma, deptId);
    groupCache.set(deptId, root);
    return root;
  };

  switch (current.scope) {
    case VisibilityScope.self:
      return [];
    case VisibilityScope.team:
      // 본인 팀(부서) — 단일 노드. (팀 하위가 없으므로 자기 부서만)
      return [current.departmentId];
    case VisibilityScope.division:
      // 본인 본부 하위 전원(본인 부서가 본부면 그 하위, 팀이면 본부로 올라가 하위 전체)
      return descendantDeptIds(prisma, await cachedDivisionRootOf(current.departmentId));
    case VisibilityScope.group:
      return descendantDeptIds(prisma, await cachedGroupRootOf(current.departmentId));
    default:
      return [];
  }
}

/**
 * target 사용자가 현재 사용자의 가시 범위에 있는지.
 * visibilityScope 기준. 본인은 항상 가시.
 */
export async function canViewUser(
  prisma: PrismaService,
  current: AuthUser,
  targetUserId: string,
): Promise<boolean> {
  if (current.role === Role.hr_admin || current.scope === VisibilityScope.company) return true;
  if (current.id === targetUserId) return true;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, departmentId: true },
  });
  if (!target) return false;
  if (current.scope === VisibilityScope.self) return false;
  if (!target.departmentId) return false;

  const deptIds = await visibleDeptIds(prisma, current);
  if (deptIds === null) return true; // company
  return deptIds.includes(target.departmentId);
}

/** Prisma where 절에 가시 범위를 적용(본인 OR 가시 부서). hr_admin/company 는 제한 없음. */
export async function applyUserScope(
  prisma: PrismaService,
  current: AuthUser,
  where: Prisma.UserWhereInput,
): Promise<Prisma.UserWhereInput> {
  if (current.role === Role.hr_admin || current.scope === VisibilityScope.company) return where;
  const deptIds = await visibleDeptIds(prisma, current);
  if (deptIds === null) return where;
  const scopeOr: Prisma.UserWhereInput[] = [{ id: current.id }];
  if (deptIds.length) scopeOr.push({ departmentId: { in: deptIds } });
  return { AND: [where, { OR: scopeOr }] };
}

// ─────────────────────── 트리 헬퍼 ───────────────────────

/** deptId 가 속한 본부(division) 노드 id. 본인이 division 이면 자신, team 이면 부모 division, group 이면 자신. */
async function divisionRootOf(
  prisma: PrismaService,
  deptId: string,
): Promise<string> {
  let cursor: string | null = deptId;
  for (let i = 0; i < 10 && cursor; i++) {
    const dept = await prisma.department.findUnique({ where: { id: cursor } });
    if (!dept) break;
    if (dept.type === 'division') return dept.id;
    if (dept.type === 'group') return dept.id; // 그룹 직속이면 그룹 기준
    cursor = dept.parentId;
  }
  return deptId;
}

/** deptId 가 속한 그룹(group) 노드 id (최상위로 상향). */
async function groupRootOf(prisma: PrismaService, deptId: string): Promise<string> {
  let cursor: string | null = deptId;
  let last = deptId;
  for (let i = 0; i < 10 && cursor; i++) {
    const dept = await prisma.department.findUnique({ where: { id: cursor } });
    if (!dept) break;
    last = dept.id;
    if (dept.type === 'group') return dept.id;
    cursor = dept.parentId;
  }
  return last;
}

/** rootId 와 그 하위 부서 id 전체(자신 포함). */
export async function descendantDeptIds(
  prisma: PrismaService,
  rootId: string | null,
): Promise<string[]> {
  if (!rootId) return [];
  const all = await prisma.department.findMany({ select: { id: true, parentId: true } });
  const result = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const d of all) {
      if (d.parentId && result.has(d.parentId) && !result.has(d.id)) {
        result.add(d.id);
        changed = true;
      }
    }
  }
  return Array.from(result);
}

/** childDeptId 가 ancestorDeptId 의 하위(또는 동일)인지 트리 상향 탐색. */
export async function isDepartmentUnder(
  prisma: PrismaService,
  childDeptId: string | null,
  ancestorDeptId: string | null,
): Promise<boolean> {
  if (!childDeptId || !ancestorDeptId) return false;
  let cursor: string | null = childDeptId;
  for (let i = 0; i < 10 && cursor; i++) {
    if (cursor === ancestorDeptId) return true;
    const dept = await prisma.department.findUnique({ where: { id: cursor } });
    cursor = dept?.parentId ?? null;
  }
  return false;
}
