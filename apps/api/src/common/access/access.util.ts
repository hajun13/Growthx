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
 * 한 부서의 '장(head)' 사용자 id — **명시 지정(Department.headUserId) 단일 기준**.
 * 권한 레벨(role)과 평가 조직을 분리한다: hr_admin 등 권한을 열어줘도 평가자 배정은
 * 사용자 관리(조직도)에서 지정한 부서장 그대로 따라간다. 과거의 role(team_lead/
 * division_head)·직책(position) 자동 추론은 폐기 — 권한 승격이 부서장을 배정 후보에서
 * 빼거나(role 변경), 동일 직책 다수일 때 임의 인물이 장이 되는 문제가 있었다.
 * 규칙:
 *  - headUserId 미지정 부서 = 그 계층에 장 없음 → 해당 평가 단계는 비우고 상위가 평가.
 *  - excludeUserId(피평가자 본인)가 장이면 그 단계는 건너뛴다(자기평가 방지).
 *  - 비활성(퇴사 등) 부서장은 무시(단계 스킵) — 재지정 전까지 상위가 평가.
 */
export async function deptHeadUserId(
  prisma: PrismaService,
  dept: { id: string; type: string; headUserId?: string | null },
  excludeUserId: string,
): Promise<string | null> {
  if (!dept.headUserId || dept.headUserId === excludeUserId) return null;
  const head = await prisma.user.findUnique({
    where: { id: dept.headUserId },
    select: { isActive: true },
  });
  return head?.isActive ? dept.headUserId : null;
}

/**
 * 피평가자 기준으로 위쪽 '장'들을 찾아 **다단계 부서장 평가자**를 정한다.
 * 부서장(downward) 평가 = 최대 3단계. 최종(round3)은 항상 그룹장(그룹대표),
 * 그 앞 단계(round1·2)는 피평가자에서 가장 가까운 상급 장 순서대로 채운다:
 *  - 일반 직원: 1차 팀장 → 2차 본부장 → 최종 그룹장
 *  - 팀장:      1차 본부장 → (2차 부그룹장) → 최종 그룹장
 *  - 본부장:    (1차 부그룹장) → 최종 그룹장
 *  - 부그룹장:  최종 그룹장
 * 부그룹장(Department.deputyHeadUserId, group 전용)은 사슬의 끝에 붙어 —
 * 일반 직원은 팀장·본부장으로 두 자리가 이미 차므로 관여하지 않고,
 * 장(팀장·본부장)의 평가에만 승급 단계로 들어온다. 미지정 그룹은 기존과 동일.
 * 본인 제외: 자기가 그 부서의 장이면 그 단계는 건너뛴다(deptHeadUserId 가 본인 제외).
 * 무한루프 방지 최대 깊이 10.
 */
export async function resolveDownwardEvaluators(
  prisma: PrismaService,
  evaluateeId: string,
): Promise<{
  round1?: string;
  round2?: string;
  round3?: string;
  /**
   * PPT 예외② 식별: 최종평가자(그룹장)가 피평가자 사슬의 2차 자리(팀장 다음 계층 —
   * 본부장·부그룹장)도 겸직. 배정은 중복 제거로 round3 에만 들어가므로 결과 집계가
   * 이 플래그 없이는 예외②(1차 70%+최종 30%)를 인식하지 못한다.
   */
  finalAlsoSecond?: boolean;
}> {
  const evaluatee = await prisma.user.findUnique({
    where: { id: evaluateeId },
    select: { departmentId: true },
  });
  if (!evaluatee?.departmentId) return {};

  // 위로 올라가며 계층별 장을 수집. 같은 계층은 가장 가까운 1명만(첫 매칭 유지).
  let teamHead: string | null = null;
  let divisionHead: string | null = null;
  let deputyHead: string | null = null;
  let groupHead: string | null = null;

  let cursor: string | null = evaluatee.departmentId;
  for (let i = 0; i < 10 && cursor; i++) {
    const dept: {
      id: string;
      type: string;
      parentId: string | null;
      headUserId: string | null;
      deputyHeadUserId: string | null;
    } | null = await prisma.department.findUnique({
      where: { id: cursor },
      select: { id: true, type: true, parentId: true, headUserId: true, deputyHeadUserId: true },
    });
    if (!dept) break;
    // 그룹대표(그 그룹의 명시 지정 장 본인)는 하향평가를 받지 않는다 — 조직 최상위.
    // 이 조기 반환이 없으면 부그룹장이 지정된 그룹에서 부그룹장이 그룹대표를 평가하는
    // 상향(round3 없는 기형) 체인이 생긴다.
    if (dept.type === 'group' && dept.headUserId === evaluateeId) return {};
    const head = await deptHeadUserId(prisma, dept, evaluateeId);
    if (dept.type === 'team' && !teamHead) teamHead = head;
    else if (dept.type === 'division' && !divisionHead) divisionHead = head;
    else if (dept.type === 'group' && !groupHead) {
      groupHead = head;
      // 부그룹장: 본인·비활성 제외. 그룹장과 동일인이면 별도 단계가 아니다.
      if (dept.deputyHeadUserId && dept.deputyHeadUserId !== evaluateeId) {
        const deputy = await prisma.user.findUnique({
          where: { id: dept.deputyHeadUserId },
          select: { isActive: true },
        });
        if (deputy?.isActive) deputyHead = dept.deputyHeadUserId;
      }
    }
    cursor = dept.parentId;
  }

  // 최종(round3) 앞 단계 자리(겸직 미제거): 가까운 순 [팀장, 본부장, 부그룹장].
  // 2번째 자리가 그룹장 본인이면 = PPT 예외②(2차 평가자 = 최종평가자) 겸직 구조.
  const positions = Array.from(
    new Set([teamHead, divisionHead, deputyHead].filter((id): id is string => !!id)),
  );
  const finalAlsoSecond = !!groupHead && positions[1] === groupHead;

  // 배정용 사슬: 그룹장 동일인 제거 후 가까운 순 2명(중복 배정 방지 — 겸직자는 round3 로만).
  const prefinal = positions.filter((id) => id !== groupHead).slice(0, 2);

  const result: {
    round1?: string;
    round2?: string;
    round3?: string;
    finalAlsoSecond?: boolean;
  } = {};
  if (prefinal[0]) result.round1 = prefinal[0];
  if (prefinal[1]) result.round2 = prefinal[1];
  if (groupHead) result.round3 = groupHead;
  if (finalAlsoSecond) result.finalAlsoSecond = true;
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
