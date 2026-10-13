'use client';

// 조직 구조 탐색기 — 좌측 트리(네비)에서 부서를 고르면 우측 상세에 그 부서의
// 부서장·구성원·직속 하위조직이 펼쳐지는 마스터-디테일 레이아웃.
// 모든 부서를 한꺼번에 중첩 펼치던 기존 보드의 "정보 과부하"를 해소하고,
// 클릭 탐색을 1차 상호작용으로, 드래그&드롭(인원/부서 이동)은 보조 수단으로 둔다.
// 데이터: 부서 트리(OrgChartNode) + 사용자 목록(User[])을 프론트에서 부서별로 합성.
// 노드 행 렌더는 컴포넌트가 아니라 순수 렌더 함수로 한다 — 드래그 중 잦은 리렌더에도
// 펼침/선택 상태가 풀리거나 서브트리가 재마운트되지 않도록.
// 우측 상세·구성원 카드는 OrgStructureBoardDetail / OrgStructureBoardParts 로 분리.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Search,
  X,
} from 'lucide-react';
import type { OrgChartNode, User, PositionDef } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { OrgDetailPanel } from './OrgStructureBoardDetail';
import { ACCENT, type DragItem } from './OrgStructureBoardParts';

// 요약 바 색 점 — 정적 룩업.
const SUMMARY_DOT = {
  group: 'bg-neutral-950',
  division: 'bg-primary',
  team: 'bg-neutral-500',
  people: 'bg-neutral-950',
} as const;

export function OrgStructureBoard({
  chart,
  users,
  positions,
  isAdmin,
  onNodeAction,
  onMovePerson,
  onMoveDept,
  onSetHead,
  onSetDeputyHead,
  onAddMember,
  focusRequest,
}: {
  chart: OrgChartNode | null;
  users: User[];
  positions: PositionDef[];
  isAdmin: boolean;
  onNodeAction: (action: 'addChild' | 'rename' | 'delete', node: OrgChartNode) => void;
  onMovePerson: (userId: string, deptId: string) => void | Promise<void>;
  onMoveDept: (deptId: string, newParentId: string) => void | Promise<void>;
  // 부서장 지정/해제(userId 빈 문자열 = 해제).
  onSetHead: (deptId: string, userId: string) => void | Promise<void>;
  // 부그룹장(부대표) 지정/해제 — group 전용, 다단계 평가의 중간 단계(팀장 2차·본부장 1차).
  onSetDeputyHead?: (deptId: string, userId: string) => void | Promise<void>;
  // Part/ 수정요청 P4-① — 선택한 본부/팀에 구성원 추가(기존 배치 API 재사용, AdminUsersView가 모달 소유).
  onAddMember?: (node: OrgChartNode) => void;
  // 외부(예: "부서장 미지정 조직" 목록)에서 특정 부서를 선택·포커스. seq 증가로 같은 부서 재요청도 반영.
  focusRequest?: { deptId: string; seq: number } | null;
}) {
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const groups = chart?.children ?? [];

  // id → 노드, id → 부모 노드(브레드크럼·경로 추적용).
  const { nodeById, parentById } = useMemo(() => {
    const nodeMap = new Map<string, OrgChartNode>();
    const parentMap = new Map<string, OrgChartNode | null>();
    const walk = (node: OrgChartNode, parent: OrgChartNode | null) => {
      nodeMap.set(node.id, node);
      parentMap.set(node.id, parent);
      (node.children ?? []).forEach((c) => walk(c, node));
    };
    groups.forEach((g) => walk(g, null));
    return { nodeById: nodeMap, parentById: parentMap };
  }, [groups]);

  // 직급 정렬값(낮을수록 상위) — 멤버를 직급순으로 정렬.
  const posOrder = useMemo(() => {
    const m = new Map<string, number>();
    positions.forEach((p) => m.set(p.code, p.sortOrder));
    return m;
  }, [positions]);

  // 부서 id → 소속 멤버(직급순).
  const membersByDept = useMemo(() => {
    const orderOf = (u: User) => posOrder.get(u.position) ?? 999;
    const m = new Map<string, User[]>();
    users.forEach((u) => {
      if (!u.departmentId) return;
      const arr = m.get(u.departmentId) ?? [];
      arr.push(u);
      m.set(u.departmentId, arr);
    });
    m.forEach((list) =>
      list.sort((a, b) => orderOf(a) - orderOf(b) || a.name.localeCompare(b.name, 'ko')),
    );
    return m;
  }, [users, posOrder]);

  // 상단 요약(그룹/본부/팀/소속 인원).
  const summary = useMemo(() => {
    let g = 0;
    let d = 0;
    let t = 0;
    nodeById.forEach((n) => {
      if (n.type === 'group') g += 1;
      else if (n.type === 'division') d += 1;
      else t += 1;
    });
    const people = users.filter((u) => !!u.departmentId).length;
    return { g, d, t, people };
  }, [nodeById, users]);

  // 검색: 부서명 또는 구성원 이름 매칭 — 매칭 노드(+사람이 속한 부서) + 그 조상 모두 표시.
  const trimmedQuery = query.trim().toLowerCase();
  const visibleIds = useMemo(() => {
    const q = trimmedQuery;
    if (!q) return null; // null = 전부 표시.
    // 이름이 매칭되는 구성원의 소속 부서.
    const memberDeptIds = new Set<string>();
    users.forEach((u) => {
      if (u.departmentId && u.name.toLowerCase().includes(q)) memberDeptIds.add(u.departmentId);
    });
    const keep = new Set<string>();
    nodeById.forEach((n) => {
      if (n.name.toLowerCase().includes(q) || memberDeptIds.has(n.id)) {
        let cur: OrgChartNode | null = n;
        while (cur) {
          keep.add(cur.id);
          cur = parentById.get(cur.id) ?? null;
        }
      }
    });
    return keep;
  }, [trimmedQuery, users, nodeById, parentById]);

  // 부서장 — B-1(2026-07-07) 정합: Department.headUserId 명시 지정 단일 기준.
  // role/직급 추론 폴백 금지(평가자 배정과 표시가 어긋나면 안 된다). 비활성 사용자는 미지정 취급.
  function headOf(node: OrgChartNode): User | null {
    if (!node.headUserId) return null;
    return users.find((u) => u.id === node.headUserId && u.isActive) ?? null;
  }

  // 외부 포커스 요청 — 해당 부서 선택 + 조상 펼침 + 검색 해제.
  useEffect(() => {
    if (!focusRequest) return;
    const node = nodeById.get(focusRequest.deptId);
    if (!node) return;
    setQuery('');
    setSelectedId(focusRequest.deptId);
    setCollapsed((prev) => {
      const next = new Set(prev);
      let cur: OrgChartNode | null = node;
      while (cur) {
        next.delete(cur.id);
        cur = parentById.get(cur.id) ?? null;
      }
      return next;
    });
    // nodeById/parentById 는 chart 파생 — focusRequest.seq 변화에만 반응하면 충분.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.seq]);

  function canDrop(target: OrgChartNode): boolean {
    if (!drag) return false;
    if (drag.kind === 'person') return true; // 사람은 어느 부서로든.
    if (drag.node.id === target.id) return false;
    if (drag.node.type === 'division') return target.type === 'group';
    // 팀은 본부 또는 그룹 직속으로 이동 가능.
    if (drag.node.type === 'team') return target.type === 'division' || target.type === 'group';
    return false; // 그룹은 이동 불가.
  }

  async function doDrop(target: OrgChartNode) {
    const d = drag;
    setDrag(null);
    setOverId(null);
    if (!d || !canDrop(target)) return;
    if (d.kind === 'person') {
      if (d.fromDeptId === target.id) return;
      await onMovePerson(d.userId, target.id);
    } else {
      await onMoveDept(d.node.id, target.id);
    }
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function endDrag() {
    setDrag(null);
    setOverId(null);
  }

  // 선택 부서가 없거나 사라졌으면 첫 그룹을 기본 선택.
  const effectiveId =
    selectedId && nodeById.has(selectedId) ? selectedId : groups[0]?.id ?? null;
  const selectedNode = effectiveId ? nodeById.get(effectiveId) ?? null : null;

  // ── 좌측 트리: 노드 한 줄(순수 렌더, 재귀) ──
  function renderTreeRow(node: OrgChartNode, depth: number) {
    if (visibleIds && !visibleIds.has(node.id)) return null;
    const children = node.children ?? [];
    const hasChildren = children.length > 0;
    // 검색 중에는 매칭 경로를 항상 펼쳐 보여준다.
    const open = visibleIds ? true : !collapsed.has(node.id);
    const isSelected = node.id === effectiveId;
    const droppable = canDrop(node);
    const isOver = overId === node.id && droppable;
    const accent = ACCENT[node.type];
    const count = membersByDept.get(node.id)?.length ?? 0;

    return (
      <div key={node.id}>
        <div
          onClick={() => setSelectedId(node.id)}
          onDragOver={(e) => {
            if (droppable) {
              e.preventDefault();
              e.stopPropagation();
              setOverId(node.id);
            }
          }}
          onDrop={(e) => {
            if (droppable) {
              e.preventDefault();
              e.stopPropagation();
              void doDrop(node);
            }
          }}
          // 들여쓰기는 깊이별 동적 값 — CSS 변수로 전달.
          style={{ '--pl': `${10 + depth * 16}px` } as CSSProperties}
          className={cn(
            'flex h-8.5 cursor-pointer items-center gap-1.5 border-l-2 pr-2.5 pl-(--pl)',
            isOver || isSelected ? 'bg-primary/8' : 'bg-transparent',
            isSelected ? accent.bar : 'border-l-transparent',
          )}
          title={node.name}
        >
          {/* 펼침 토글(자식 있을 때만) */}
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon-2xs"
              className="size-3.5"
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.id);
              }}
              aria-label={open ? '접기' : '펼치기'}
            >
              {open ? (
                <ChevronDown className="size-3.5 text-neutral-500" />
              ) : (
                <ChevronRight className="size-3.5 text-neutral-500" />
              )}
            </Button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          {/* 부서장 드래그 핸들(그룹 제외, 관리자만) */}
          {isAdmin && node.type !== 'group' ? (
            <span
              draggable
              onClick={(e) => e.stopPropagation()}
              onDragStart={(e) => {
                setDrag({ kind: 'dept', node });
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={endDrag}
              title="드래그해서 상위 조직을 바꿀 수 있어요"
              className="flex shrink-0 cursor-grab text-neutral-400"
            >
              <GripVertical className="size-3.25" />
            </span>
          ) : (
            <span className="w-1 shrink-0" />
          )}
          {/* 타입 점 */}
          <span className={cn('inline-block size-1.75 shrink-0 rounded-full', accent.dot)} />
          {/* 이름 */}
          <span
            className={cn(
              'truncate text-13',
              isSelected
                ? 'font-bold text-neutral-950'
                : cn('text-neutral-800', depth === 0 ? 'font-semibold' : 'font-medium'),
            )}
          >
            {node.name}
          </span>
          {/* 인원 수 */}
          {count > 0 && (
            <span className="ml-auto shrink-0 text-10h font-semibold text-neutral-500">{count}</span>
          )}
        </div>
        {open && hasChildren && children.map((c) => renderTreeRow(c, depth + 1))}
      </div>
    );
  }

  // ── 빈 상태 ──
  if (groups.length === 0) {
    return (
      <Card className="p-14">
        <div className="flex flex-col items-center justify-center gap-3 text-center text-13 text-neutral-500">
          <Building2 className="size-8 text-neutral-300" />
          <div>
            <p className="mb-1 font-semibold text-neutral-700">조직이 아직 없어요.</p>
            <p className="text-12 text-neutral-400">오른쪽 위 &quot;그룹 추가&quot;로 시작하세요.</p>
          </div>
        </div>
      </Card>
    );
  }

  const summaryItems = [
    { label: '그룹', value: summary.g, dot: SUMMARY_DOT.group },
    { label: '본부', value: summary.d, dot: SUMMARY_DOT.division },
    { label: '팀', value: summary.t, dot: SUMMARY_DOT.team },
    { label: '소속 인원', value: summary.people, dot: SUMMARY_DOT.people },
  ];

  const detailNode = selectedNode;
  const detailMembers = detailNode ? membersByDept.get(detailNode.id) ?? [] : [];
  // 부그룹장은 명시 지정만(자동 추론 없음). 그룹 외 타입은 항상 null.
  const detailDeputy =
    detailNode?.type === 'group' && detailNode.deputyHeadUserId
      ? detailMembers.find((m) => m.id === detailNode.deputyHeadUserId) ?? null
      : null;
  // 브레드크럼 경로(루트 → 현재).
  const detailPath: OrgChartNode[] = [];
  for (let cur: OrgChartNode | null = detailNode; cur; cur = parentById.get(cur.id) ?? null) {
    detailPath.unshift(cur);
  }
  const detailDroppable = detailNode ? canDrop(detailNode) : false;

  return (
    <div className="space-y-3">
      {/* 요약 바 */}
      <div className="flex flex-wrap items-center gap-2 px-0.5 pt-1 pb-2">
        {summaryItems.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            {i > 0 && <span className="text-12 text-neutral-400">/</span>}
            <span className={cn('inline-block size-1.25 rounded-full', s.dot)} />
            <span className="text-12 text-neutral-600">{s.label}</span>
            <span className="text-14 font-bold text-neutral-950">{s.value}</span>
          </div>
        ))}
        {isAdmin && (
          <span className="ml-auto text-11h text-neutral-400">
            트리에서 부서를 누르면 상세가 열려요. 드래그로 이동도 돼요.
          </span>
        )}
      </div>

      {/* 마스터-디테일 */}
      <div className="flex items-start gap-3">
        {/* 좌측: 트리 네비게이터 */}
        <Card className="w-80 min-w-65 shrink overflow-hidden">
          {/* 검색 */}
          <div className="border-b border-border p-2.5">
            <InputGroup className="h-8">
              <InputGroupAddon>
                <Search className="text-neutral-400" />
              </InputGroupAddon>
              <InputGroupInput
                className="text-12h"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="부서·구성원 이름 검색"
              />
              {query && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton size="icon-xs" onClick={() => setQuery('')} aria-label="검색 지우기">
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
          </div>
          {/* 트리 — 560px 고정 대신 뷰포트 연동(검색바 높이만큼 상세보다 짧게). */}
          <div
            style={{ '--mh': 'calc(100vh - 340px)' } as CSSProperties}
            className="max-h-(--mh) min-h-60 overflow-auto py-1.5"
          >
            {visibleIds && visibleIds.size === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-7 text-center text-12h text-neutral-400">
                <Search className="size-4.5 text-neutral-300" />
                <span>&apos;{query}&apos;에 맞는 부서·구성원이 없어요.</span>
              </div>
            ) : (
              groups.map((g) => renderTreeRow(g, 0))
            )}
          </div>
        </Card>

        {/* 우측: 상세 */}
        <div className="min-w-0 flex-1">
          {detailNode ? (
            <OrgDetailPanel
              node={detailNode}
              path={detailPath}
              members={detailMembers}
              head={headOf(detailNode)}
              deputy={detailDeputy}
              isAdmin={isAdmin}
              positions={positions}
              isOver={overId === detailNode.id && detailDroppable}
              personDragging={drag?.kind === 'person'}
              trimmedQuery={trimmedQuery}
              onSelect={setSelectedId}
              onNodeAction={onNodeAction}
              onAddMember={onAddMember}
              onSetHead={onSetHead}
              onSetDeputyHead={onSetDeputyHead}
              onMemberDragStart={(u) =>
                setDrag({ kind: 'person', userId: u.id, name: u.name, fromDeptId: u.departmentId })
              }
              onDragEnd={endDrag}
              onZoneDragOver={(e) => {
                if (detailDroppable) {
                  e.preventDefault();
                  setOverId(detailNode.id);
                }
              }}
              onZoneDrop={(e) => {
                if (detailDroppable) {
                  e.preventDefault();
                  void doDrop(detailNode);
                }
              }}
            />
          ) : (
            <Card className="p-14">
              <div className="flex flex-col items-center justify-center gap-2 text-13 text-neutral-400">
                <Building2 className="size-6 text-neutral-300" />
                왼쪽에서 부서를 선택하세요.
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
