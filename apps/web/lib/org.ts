// 조직도 보조 — OrgChartNode 트리 평탄화·경로 산출·자동기본 역할/범위.
// 백엔드가 OrgChartNode(트리)와 User[](인물)를 별도로 주므로,
// deptId → deptPath(이름 배열)·노드 메타를 프론트에서 합성한다.

import type {
  OrgChartNode,
  OrgNodeType,
  Position,
  Role,
  VisibilityScope,
} from './types';

export interface FlatNode {
  id: string;
  name: string;
  type: OrgNodeType;
  parentId: string | null;
  depth: number; // group=0, division=1, team=2 (company 루트 제외)
}

// 회사 루트('company')를 제외한 실제 조직 노드를 평탄화(deptId 매핑용).
export function flattenOrg(root: OrgChartNode | null): Map<string, FlatNode> {
  const map = new Map<string, FlatNode>();
  if (!root) return map;
  const walk = (node: OrgChartNode, depth: number) => {
    if (node.id !== 'company') {
      map.set(node.id, {
        id: node.id,
        name: node.name,
        type: node.type,
        parentId: node.parentId,
        depth,
      });
    }
    const childDepth = node.id === 'company' ? 0 : depth + 1;
    for (const c of node.children ?? []) walk(c, childDepth);
  };
  walk(root, 0);
  return map;
}

// deptId → 상위까지의 이름 경로(["그룹","본부","팀"]).
export function deptPath(
  deptId: string | null | undefined,
  flat: Map<string, FlatNode>,
): string[] {
  const path: string[] = [];
  let cur = deptId ? flat.get(deptId) : undefined;
  let guard = 0;
  while (cur && guard < 10) {
    path.unshift(cur.name);
    cur = cur.parentId ? flat.get(cur.parentId) : undefined;
    guard += 1;
  }
  return path;
}

// deptId → 조직 type별 이름. 비표준 계층(그룹 직속 팀 등)도 자리를 어긋나지 않게 분류.
// deptPath 는 순서대로 쌓아 그룹 직속 팀이면 본부 칸에 팀이 들어가므로, 표시는 이 함수를 쓴다.
export function deptByType(
  deptId: string | null | undefined,
  flat: Map<string, FlatNode>,
): { group: string; division: string; team: string } {
  const out = { group: '', division: '', team: '' };
  let cur = deptId ? flat.get(deptId) : undefined;
  let guard = 0;
  while (cur && guard < 10) {
    if (cur.type === 'group') out.group = cur.name;
    else if (cur.type === 'division') out.division = cur.name;
    else if (cur.type === 'team') out.team = cur.name;
    cur = cur.parentId ? flat.get(cur.parentId) : undefined;
    guard += 1;
  }
  return out;
}

// 한 노드 하위(자신 포함)의 모든 노드 id 집합(인물 필터: 선택 노드+하위 전원).
export function descendantDeptIds(
  root: OrgChartNode | null,
  nodeId: string | null,
): Set<string> | null {
  if (!root) return null;
  // null(=회사 루트) 선택 → 전체(필터 없음).
  if (nodeId === null || nodeId === 'company') return null;
  const found = findNode(root, nodeId);
  if (!found) return new Set();
  const ids = new Set<string>();
  const walk = (n: OrgChartNode) => {
    ids.add(n.id);
    for (const c of n.children ?? []) walk(c);
  };
  walk(found);
  return ids;
}

export function findNode(
  root: OrgChartNode | null,
  id: string,
): OrgChartNode | null {
  if (!root) return null;
  if (root.id === id) return root;
  for (const c of root.children ?? []) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

// 직급 → 자동기본 role(계약 Item2). 오버라이드 여부 판정·PersonEditModal 프리필.
export function defaultRoleForPosition(position: Position): Role {
  switch (position) {
    case 'ceo':
    case 'president':
    case 'vice_president':
    case 'executive':
    case 'director':
    case 'division_head':
      return 'division_head';
    case 'team_lead':
      return 'team_lead';
    default:
      return 'employee';
  }
}

// 직급 → 자동기본 visibilityScope(계약 Item2). 인사총무팀(hr_admin/company)은 별도.
export function defaultScopeForPosition(position: Position): VisibilityScope {
  switch (position) {
    case 'ceo':
    case 'president':
    case 'vice_president':
    case 'executive':
    case 'director':
      return 'group';
    case 'division_head':
      return 'division';
    case 'team_lead':
      return 'team';
    default:
      return 'self';
  }
}
