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
 *  - team     : 그 부서 소속 user 중 role=team_lead
 *  - division : role=division_head
 *  - group    : position ∈ {ceo, vice_president, executive, director} 중 최상위 1명
 * 팀장·본부장은 **직책(position)이 아닌 역할(role)** 로 식별한다 — 회사에 '팀장'이라는
 * 직책이 없고 수석·선임 등이 팀장을 맡는 구조이므로, 누가 장인지는 부여된 역할로 정한다.
 * 반면 group(대표이사급)은 직책 우선순위가 명확하므로 position 기준을 유지한다.
 * excludeUserId(피평가자 본인)는 후보에서 제외 — 자기 자신이 그 부서의 장이면 건너뛴다.
 * 후보 다수 시 결정적 결과를 위해 id 정렬 후 1명.
 */
async function deptHeadUserId(
  prisma: PrismaService,
  dept: { id: string; type: string; headUserId?: string | null },
  excludeUserId: string,
): Promise<string | null> {
  // 명시적으로 지정된 부서장(headUserId)이 있으면 자동 추론보다 우선한다.
  // 본인(피평가자) 제외 + 활성 사용자일 때만.
  if (dept.headUserId && dept.headUserId !== excludeUserId) {
    const head = await prisma.user.findUnique({
      where: { id: dept.headUserId },
      select: { isActive: true },
    });
    if (head?.isActive) return dept.headUserId;
  }

  // team·division: 부서 type 에 대응하는 관리 역할(role)로 장을 찾는다(직책 무관).
  if (dept.type === 'team' || dept.type === 'division') {
    const targetRole = dept.type === 'team' ? Role.team_lead : Role.division_head;
    const candidates = await prisma.user.findMany({
      where: {
        departmentId: dept.id,
        isActive: true,
        role: targetRole,
        id: { not: excludeUserId },
      },
      select: { id: true },
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return candidates[0].id;
  }

  // group: 직책 우선순위(상위 직책일수록 먼저)로 1명을 고른다.
  if (dept.type === 'group') {
    const groupRank: Position[] = [
      Position.ceo,
      Position.president,
      Position.vice_president,
      Position.executive,
      Position.director,
    ];
    const candidates = await prisma.user.findMany({
      where: {
        departmentId: dept.id,
        isActive: true,
        position: { in: groupRank },
        id: { not: excludeUserId },
      },
      select: { id: true, position: true },
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const ra = groupRank.indexOf(a.position);
      const rb = groupRank.indexOf(b.position);
      if (ra !== rb) return ra - rb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return candidates[0].id;
  }

  return null;
}

/**
 * 피평가자 기준으로 위쪽 '장'들을 찾아 **다단계 부서장 평가자**를 정한다.
 * 부서장(downward) 평가 = 1차(팀장)·2차(본부장)·최종(그룹대표) 3단계.
 *  - round1 = 위로 올라가며 만나는 첫 팀(team)의 장(팀장)
 *  - round2 = 첫 본부(division)의 장(본부장)
 *  - round3 = 첫 그룹(group)의 장(그룹대표)
 * 즉 상위 계층이 하위 전원을 평가한다(본부장→팀장·팀원, 그룹대표→전원).
 * 본인 제외: 자기가 그 부서의 장이면 그 단계는 건너뛴다(deptHeadUserId 가 본인 제외) →
 *   예: 팀장 본인은 round1 없음(round2 본부장·round3 대표만), 본부장은 round3 만, 그룹대표는 없음.
 * 무한루프 방지 최대 깊이 10.
 */
export async function resolveDownwardEvaluators(
  prisma: PrismaService,
  evaluateeId: string,
): Promise<{ round1?: string; round2?: string; round3?: string }> {
  const evaluatee = await prisma.user.findUnique({
    where: { id: evaluateeId },
    select: { departmentId: true },
  });
  if (!evaluatee?.departmentId) return {};

  const result: { round1?: string; round2?: string; round3?: string } = {};
  let cursor: string | null = evaluatee.departmentId;
  for (let i = 0; i < 10 && cursor; i++) {
    const dept: {
      id: string;
      type: string;
      parentId: string | null;
      headUserId: string | null;
    } | null = await prisma.department.findUnique({
      where: { id: cursor },
      select: { id: true, type: true, parentId: true, headUserId: true },
    });
    if (!dept) break;
    const head = await deptHeadUserId(prisma, dept, evaluateeId);
    if (head) {
      // 부서 type → 평가 단계(round) 매핑. 같은 단계는 가장 가까운 1명만(첫 매칭 유지).
      if (dept.type === 'team' && !result.round1) result.round1 = head;
      else if (dept.type === 'division' && !result.round2) result.round2 = head;
      else if (dept.type === 'group' && !result.round3) result.round3 = head;
    }
    cursor = dept.parentId;
  }

  return result;
}

// ─────────────── 조직 스냅샷 id 산정(결함 #7) ───────────────

/** 부서 트리 노드(스냅샷 산정에 필요한 최소 필드). */
export interface DeptTreeNode {
  id: string;
  name: string;
  type: string; // 'group' | 'division' | 'team'
  parentId: string | null;
}

/** 부서 id 기준 group/division/team 의 id·name 스냅샷. */
export interface DeptSnapshot {
  groupId: string | null;
  divisionId: string | null;
  teamId: string | null;
  groupName: string | null;
  divisionName: string | null;
  teamName: string | null;
}

/** 전체 부서 트리를 한 번 적재(스냅샷 산정용 노드 배열). N+1 방지 캐시 소스. */
export async function loadDeptTree(prisma: PrismaService): Promise<DeptTreeNode[]> {
  return prisma.department.findMany({
    select: { id: true, name: true, type: true, parentId: true },
  });
}

/**
 * 부서 트리에서 deptId 의 조상을 상향 탐색해 group/division/team 의 id·name 을 산정.
 * deptId 가 null/미존재면 모두 null. 순수 함수(트리는 호출부가 1회 적재).
 */
export function deptSnapshotFromTree(
  tree: DeptTreeNode[],
  deptId: string | null,
): DeptSnapshot {
  const empty: DeptSnapshot = {
    groupId: null,
    divisionId: null,
    teamId: null,
    groupName: null,
    divisionName: null,
    teamName: null,
  };
  if (!deptId) return empty;
  const byId = new Map(tree.map((d) => [d.id, d]));
  const out: DeptSnapshot = { ...empty };
  let cursor: string | null = deptId;
  for (let i = 0; i < 10 && cursor; i++) {
    const node = byId.get(cursor);
    if (!node) break;
    if (node.type === 'group' && out.groupId === null) {
      out.groupId = node.id;
      out.groupName = node.name;
    } else if (node.type === 'division' && out.divisionId === null) {
      out.divisionId = node.id;
      out.divisionName = node.name;
    } else if (node.type === 'team' && out.teamId === null) {
      out.teamId = node.id;
      out.teamName = node.name;
    }
    cursor = node.parentId;
  }
  return out;
}

/**
 * 부서명(부모 경로 포함)으로 부서 id 를 유일 식별해 그 부서의 id 스냅샷을 산정.
 * 퇴사자(departmentId 없음)·백필 폴백용. 동명 부서가 여럿이면 부모경로(group/division)로
 * 좁히고, 그래도 유일하지 않으면 null 들을 반환(미매칭).
 *  - team 이름 주어짐 → team 노드 중 (이름 + 상위 division/group 일치) 유일한 것
 *  - division 만 주어짐(team 없음) → division 노드 중 (이름 + 상위 group 일치) 유일한 것
 *  - group 만 주어짐 → group 노드 중 이름 일치 유일한 것
 * 매칭된 노드를 찾으면 deptSnapshotFromTree 로 id 트리오를 채운다.
 */
export function deptSnapshotFromNames(
  tree: DeptTreeNode[],
  groupName: string | null,
  divisionName: string | null,
  teamName: string | null,
): DeptSnapshot {
  const empty: DeptSnapshot = {
    groupId: null,
    divisionId: null,
    teamId: null,
    groupName,
    divisionName,
    teamName,
  };
  const byId = new Map(tree.map((d) => [d.id, d]));

  // 한 노드의 조상 이름 경로(group/division/team) 산정.
  const ancestryNames = (deptId: string) => {
    let group: string | null = null;
    let division: string | null = null;
    let cursor: string | null = deptId;
    for (let i = 0; i < 10 && cursor; i++) {
      const n = byId.get(cursor);
      if (!n) break;
      if (n.type === 'group' && group === null) group = n.name;
      else if (n.type === 'division' && division === null) division = n.name;
      cursor = n.parentId;
    }
    return { group, division };
  };

  let candidates: DeptTreeNode[];
  if (teamName) {
    candidates = tree.filter((d) => d.type === 'team' && d.name === teamName);
    if (candidates.length > 1) {
      candidates = candidates.filter((d) => {
        const a = ancestryNames(d.id);
        if (groupName && a.group !== groupName) return false;
        if (divisionName && a.division !== divisionName) return false;
        return true;
      });
    }
  } else if (divisionName) {
    candidates = tree.filter((d) => d.type === 'division' && d.name === divisionName);
    if (candidates.length > 1 && groupName) {
      candidates = candidates.filter((d) => ancestryNames(d.id).group === groupName);
    }
  } else if (groupName) {
    candidates = tree.filter((d) => d.type === 'group' && d.name === groupName);
  } else {
    return empty;
  }

  if (candidates.length !== 1) return empty; // 미매칭 또는 모호 → id 채우지 않음.
  // 매칭 노드의 id 트리오 산정(이름은 인자 우선 보존).
  const snap = deptSnapshotFromTree(tree, candidates[0].id);
  return {
    ...snap,
    groupName: groupName ?? snap.groupName,
    divisionName: divisionName ?? snap.divisionName,
    teamName: teamName ?? snap.teamName,
  };
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
