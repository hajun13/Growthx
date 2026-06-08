'use client';

// 조직 구조 보드 — 그룹→본부→팀 계층에 사람(그룹장·본부장·팀장·팀원)을 표시하고,
// 네이티브 드래그&드롭으로 사람(부서 간 이동)과 부서 노드(상위 변경)를 옮긴다.
// 데이터: 부서 트리(OrgChartNode) + 사용자 목록(User[])을 프론트에서 부서별로 합성.
// 주의: 노드 렌더는 컴포넌트가 아니라 순수 렌더 함수(renderNode)로 한다 —
//       드래그 중 잦은 리렌더에도 펼침 상태가 풀리거나 서브트리가 재마운트되지 않도록.
import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Crown,
  GripVertical,
  UserRound,
} from 'lucide-react';
import type { OrgChartNode, User, PositionDef, OrgNodeType } from '@/lib/types';
import { getPositionLabel } from '@/lib/ui';
import { T } from '@/lib/toss';

const ORG_TYPE_LABEL: Record<OrgNodeType, string> = {
  group: '그룹',
  division: '본부',
  team: '팀',
};

const HEAD_LABEL: Record<OrgNodeType, string> = {
  group: '그룹장',
  division: '본부장',
  team: '팀장',
};

type DragItem =
  | { kind: 'person'; userId: string; name: string; fromDeptId: string | null }
  | { kind: 'dept'; node: OrgChartNode };

export function OrgStructureBoard({
  chart,
  users,
  positions,
  isAdmin,
  onNodeAction,
  onMovePerson,
  onMoveDept,
  onSetHead,
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
}) {
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  function headOf(node: OrgChartNode, members: User[]): User | null {
    // 명시적으로 지정된 부서장이 멤버에 있으면 최우선.
    if (node.headUserId) {
      const explicit = members.find((m) => m.id === node.headUserId);
      if (explicit) return explicit;
    }
    // 자동 추론(role 기반) 폴백.
    if (node.type === 'team') return members.find((m) => m.role === 'team_lead') ?? null;
    if (node.type === 'division')
      return members.find((m) => m.role === 'division_head') ?? null;
    // group: 관리자(hr_admin) 우선, 없으면 최상위 직급.
    return members.find((m) => m.role === 'hr_admin') ?? members[0] ?? null;
  }

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

  // ── 사람 칩(순수 렌더) ──
  function renderPerson(user: User, isHead: boolean, deptType: OrgNodeType, deptId: string) {
    return (
      <div
        key={user.id}
        draggable={isAdmin}
        onDragStart={(e) => {
          setDrag({ kind: 'person', userId: user.id, name: user.name, fromDeptId: user.departmentId });
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => { setDrag(null); setOverId(null); }}
        title={isAdmin ? '드래그해서 다른 부서로 옮길 수 있어요' : undefined}
        className="flex items-center gap-2"
        style={{
          padding: '5px 8px 5px 6px',
          background: isHead ? '#EEF4FF' : '#fff',
          border: `1px solid ${isHead ? '#C5DBFF' : T.grey200}`,
          cursor: isAdmin ? 'grab' : 'default',
          opacity: user.isActive ? 1 : 0.5,
        }}
      >
        <span
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 24, height: 24, background: isHead ? T.blue500 : T.grey300, color: '#fff', fontSize: 11, fontWeight: 700 }}
        >
          {user.name.slice(0, 1)}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.grey900 }}>{user.name}</span>
        <span style={{ fontSize: 11, color: T.grey500 }}>
          {getPositionLabel(user.position, positions)}
        </span>
        {isHead ? (
          isAdmin ? (
            <button
              onClick={(e) => { e.stopPropagation(); void onSetHead(deptId, ''); }}
              title={`${HEAD_LABEL[deptType]} 지정을 해제해요`}
              className="flex items-center gap-0.5"
              style={{ fontSize: 10, fontWeight: 700, color: T.blue700, marginLeft: 2, cursor: 'pointer' }}
            >
              <Crown size={11} /> {HEAD_LABEL[deptType]}
            </button>
          ) : (
            <span className="flex items-center gap-0.5" style={{ fontSize: 10, fontWeight: 700, color: T.blue700, marginLeft: 2 }}>
              <Crown size={11} /> {HEAD_LABEL[deptType]}
            </span>
          )
        ) : isAdmin ? (
          <button
            onClick={(e) => { e.stopPropagation(); void onSetHead(deptId, user.id); }}
            title={`${HEAD_LABEL[deptType]}으로 지정해요`}
            style={{ display: 'flex', marginLeft: 2, color: T.grey300, cursor: 'pointer' }}
          >
            <Crown size={11} />
          </button>
        ) : null}
      </div>
    );
  }

  // ── 부서 노드(순수 렌더, 재귀) ──
  function renderNode(node: OrgChartNode, depth: number) {
    const open = !collapsed.has(node.id);
    const members = membersByDept.get(node.id) ?? [];
    const head = headOf(node, members);
    const children = node.children ?? [];
    const droppable = canDrop(node);
    const isOver = overId === node.id && droppable;
    const accent = depth === 0 ? T.blue500 : depth === 1 ? T.grey700 : T.grey500;

    return (
      <div
        key={node.id}
        style={{ marginLeft: depth === 0 ? 0 : 16, marginTop: depth === 0 ? 0 : 8 }}
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
      >
        <div
          style={{
            border: `1px solid ${isOver ? T.blue500 : T.grey200}`,
            borderLeft: `3px solid ${accent}`,
            background: isOver ? '#EEF4FF' : '#fff',
          }}
        >
          {/* 헤더 */}
          <div
            className="flex items-center gap-2"
            style={{ padding: '9px 12px', background: isOver ? 'transparent' : T.grey50, borderBottom: `1px solid ${T.grey100}` }}
          >
            {isAdmin && node.type !== 'group' && (
              <span
                draggable
                onDragStart={(e) => {
                  setDrag({ kind: 'dept', node });
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => { setDrag(null); setOverId(null); }}
                title="드래그해서 상위 조직을 바꿀 수 있어요"
                style={{ cursor: 'grab', color: T.grey400, display: 'flex' }}
              >
                <GripVertical size={14} />
              </span>
            )}
            <button onClick={() => toggle(node.id)} style={{ display: 'flex', color: T.grey500 }} aria-label={open ? '접기' : '펼치기'}>
              {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
            <span className="is-circle flex-shrink-0" style={{ width: 8, height: 8, background: accent, display: 'inline-block' }} />
            <span style={{ fontSize: 13.5, fontWeight: depth === 0 ? 700 : 600, color: T.grey900 }}>{node.name}</span>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: T.grey600, background: T.grey100, padding: '1px 7px' }}>
              {ORG_TYPE_LABEL[node.type]}
            </span>
            {head && (
              <span className="flex items-center gap-1" style={{ fontSize: 11, color: T.grey600 }}>
                <Crown size={11} color={T.blue500} />
                {head.name}
              </span>
            )}
            <span style={{ fontSize: 11, color: T.grey400, marginLeft: 'auto' }}>{node.totalCount}명</span>

            {isAdmin && (
              <div className="flex items-center gap-2.5">
                {node.type !== 'team' && (
                  <button onClick={() => onNodeAction('addChild', node)} style={{ fontSize: 11, fontWeight: 600, color: T.blue500 }}>
                    + {node.type === 'group' ? '본부·팀' : '팀'}
                  </button>
                )}
                <button onClick={() => onNodeAction('rename', node)} style={{ fontSize: 11, color: T.grey600 }}>이름</button>
                <button onClick={() => onNodeAction('delete', node)} style={{ fontSize: 11, color: T.red500 }}>삭제</button>
              </div>
            )}
          </div>

          {/* 본문 */}
          {open && (
            <div style={{ padding: '10px 12px' }}>
              {members.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => renderPerson(m, m.id === head?.id, node.type, node.id))}
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5"
                  style={{
                    fontSize: 11.5,
                    color: drag?.kind === 'person' ? T.blue500 : T.grey400,
                    padding: '4px 2px',
                    fontWeight: drag?.kind === 'person' ? 600 : 400,
                  }}
                >
                  <UserRound size={12} />
                  {drag?.kind === 'person' ? '여기로 드롭하면 이 부서로 옮겨져요' : '소속 구성원이 없어요'}
                </div>
              )}

              {/* 하위 조직 */}
              {children.map((c) => renderNode(c, depth + 1))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const groups = chart?.children ?? [];
  if (groups.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: T.grey500, fontSize: 13, background: '#fff', border: `1px solid ${T.grey200}` }}>
        조직이 아직 없어요. 오른쪽 위 “그룹 추가”로 시작하세요.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div
          className="flex items-center gap-2 flex-wrap"
          style={{ fontSize: 11.5, color: T.grey600, background: T.grey50, border: `1px solid ${T.grey200}`, padding: '8px 12px' }}
        >
          <GripVertical size={13} color={T.grey400} />
          사람 칩을 끌어 다른 부서로 옮기거나, 본부·팀의 손잡이를 끌어 상위 조직을 바꿀 수 있어요.
          <span style={{ color: T.grey400 }}>(본부→그룹, 팀→본부·그룹)</span>
        </div>
      )}
      {groups.map((g) => renderNode(g, 0))}
    </div>
  );
}
