import { Prisma, Role, VisibilityScope } from '@prisma/client';
import { Position } from './position.util';
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
  if (current.role === Role.hr_admin || current.scope === VisibilityScope.company) {
    return null;
  }
  if (!current.departmentId) {
    return [];
  }

  switch (current.scope) {
    case VisibilityScope.self:
      return [];
    case VisibilityScope.team:
      return [current.departmentId];
    case VisibilityScope.division: {
      const divRoot = await divisionRootOf(prisma, current.departmentId);
      // group 조상만 있고 division 이 없으면 본인 팀으로 한정(group 전체 노출 방지).
      if (divRoot === null) return [current.departmentId];
      return descendantDeptIds(prisma, divRoot);
    }
    case VisibilityScope.group: {
      const groupRoot = await groupRootOf(prisma, current.departmentId);
      if (groupRoot === null) return [current.departmentId];
      return descendantDeptIds(prisma, groupRoot);
    }
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

/**
 * deptId 가 속한 본부(division) 노드 id.
 * group 노드를 만나면 null 반환(division 조상 없음 — group 전체를 division scope 로 오인 방지).
 */
async function divisionRootOf(
  prisma: PrismaService,
  deptId: string,
): Promise<string | null> {
  let cursor: string | null = deptId;
  for (let i = 0; i < 10 && cursor; i++) {
    const dept = await prisma.department.findUnique({ where: { id: cursor } });
    if (!dept) break;
    if (dept.type === 'division') return dept.id;
    if (dept.type === 'group') return null;
    cursor = dept.parentId;
  }
  return null;
}

/**
 * deptId 가 속한 그룹(group) 노드 id (최상위로 상향).
 * 그룹 조상이 없으면 null 반환.
 */
export async function groupRootOf(prisma: PrismaService, deptId: string): Promise<string | null> {
  let cursor: string | null = deptId;
  for (let i = 0; i < 10 && cursor; i++) {
    const dept = await prisma.department.findUnique({ where: { id: cursor } });
    if (!dept) break;
    if (dept.type === 'group') return dept.id;
    cursor = dept.parentId;
  }
  return null;
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

// ─────────────────── 부서장(downward) 자동 배정 ───────────────────

/**
 * 한 부서의 '장(head)' 사용자 id 를 부서 type 별 규칙으로 식별.
 *  - team     : 그 부서 소속 user 중 position=team_lead
 *  - division : position=division_head
 *  - group    : position ∈ {ceo, vice_president, executive, director} 중 최상위 1명
 * excludeUserId(피평가자 본인)는 후보에서 제외 — 자기 자신이 그 부서의 장이면 건너뛴다.
 * 후보 다수 시 결정적 결과를 위해 id 정렬 후 1명.
 */
async function deptHeadUserId(
  prisma: PrismaService,
  dept: { id: string; type: string },
  excludeUserId: string,
): Promise<string | null> {
  // group 은 직책 우선순위(상위 직책일수록 먼저)로 1명을 고른다.
  const groupRank: Position[] = [
    Position.ceo,
    Position.vice_president,
    Position.executive,
    Position.director,
  ];

  let positions: Position[];
  if (dept.type === 'team') {
    positions = [Position.team_lead];
  } else if (dept.type === 'division') {
    positions = [Position.division_head];
  } else if (dept.type === 'group') {
    positions = groupRank;
  } else {
    return null;
  }

  const candidates = await prisma.user.findMany({
    where: {
      departmentId: dept.id,
      isActive: true,
      position: { in: positions },
      id: { not: excludeUserId },
    },
    select: { id: true, position: true },
  });
  if (candidates.length === 0) return null;

  // group: 직책 우선순위 → 동순위는 id 정렬. 그 외(단일 position): id 정렬.
  candidates.sort((a, b) => {
    if (dept.type === 'group') {
      const ra = groupRank.indexOf(a.position);
      const rb = groupRank.indexOf(b.position);
      if (ra !== rb) return ra - rb;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return candidates[0].id;
}

/**
 * 피평가자 기준으로 위쪽 '장'을 찾아 단일 부서장 평가자(직속·최근접)를 정한다.
 * 부서장(downward) 평가 = 피평가자 1명당 평가자 1명.
 *  - round1 = 피평가자 부서에서 조직 트리를 위로 올라가며 만나는 가장 가까운 부서장.
 * 레벨 스킵: 한 단계의 부서에 장이 없으면(deptHeadUserId=null) 그 위 부서장이 대신한다.
 * 본인 제외: 피평가자 자신은 평가자로 선정하지 않는다(deptHeadUserId 가 본인 제외).
 * 1차/2차 구분 폐기 — 모든 downward 평가 round=1, round2 는 반환하지 않는다.
 * 무한루프 방지 최대 깊이 10.
 */
export async function resolveDownwardEvaluators(
  prisma: PrismaService,
  evaluateeId: string,
): Promise<{ round1?: string }> {
  const evaluatee = await prisma.user.findUnique({
    where: { id: evaluateeId },
    select: { departmentId: true },
  });
  if (!evaluatee?.departmentId) return {};

  let cursor: string | null = evaluatee.departmentId;
  for (let i = 0; i < 10 && cursor; i++) {
    const dept: { id: string; type: string; parentId: string | null } | null =
      await prisma.department.findUnique({
        where: { id: cursor },
        select: { id: true, type: true, parentId: true },
      });
    if (!dept) break;
    const head = await deptHeadUserId(prisma, dept, evaluateeId);
    // 가장 가까운 부서장 1명을 찾으면 즉시 확정(레벨 스킵·본인 제외는 deptHeadUserId 가 처리).
    if (head) return { round1: head };
    cursor = dept.parentId;
  }

  return {};
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
