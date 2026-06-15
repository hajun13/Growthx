'use client';

// 조직 구조 탐색기 — 좌측 트리(네비)에서 부서를 고르면 우측 상세에 그 부서의
// 부서장·구성원·직속 하위조직이 펼쳐지는 마스터-디테일 레이아웃.
// 모든 부서를 한꺼번에 중첩 펼치던 기존 보드의 "정보 과부하"를 해소하고,
// 클릭 탐색을 1차 상호작용으로, 드래그&드롭(인원/부서 이동)은 보조 수단으로 둔다.
// 데이터: 부서 트리(OrgChartNode) + 사용자 목록(User[])을 프론트에서 부서별로 합성.
// 노드 행 렌더는 컴포넌트가 아니라 순수 렌더 함수로 한다 — 드래그 중 잦은 리렌더에도
// 펼침/선택 상태가 풀리거나 서브트리가 재마운트되지 않도록.
import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Crown,
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  Building2,
  X,
} from 'lucide-react';
import type { OrgChartNode, User, PositionDef, OrgNodeType } from '@/lib/types';
import { getPositionLabel, roleLabel } from '@/lib/ui';
import { T } from '@/lib/toss';

// Kinetic Enterprise 팔레트
const K = {
  primary:          '#3f2c80',
  primaryContainer: '#564599',
  secondary:        '#0054ca',
  secondaryDim:     '#336fe5',
  tertiary:         '#0e9aa0',
  surface:          '#f8f9fd',
  surfaceLow:       '#f2f3f7',
  white:            '#ffffff',
  outline:          'rgba(202,196,210,0.5)',
  outlineFull:      '#cac4d2',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

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

// 계층 깊이별 강조색(Kinetic: 그룹=primary, 본부=secondary, 팀=tertiary).
const TYPE_ACCENT: Record<OrgNodeType, string> = {
  group: K.primary,
  division: K.secondary,
  team: K.tertiary,
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

  // 검색: 이름 매칭 노드 + 그 조상 모두 표시(트리 구조 유지).
  const visibleIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null; // null = 전부 표시.
    const keep = new Set<string>();
    nodeById.forEach((n) => {
      if (n.name.toLowerCase().includes(q)) {
        let cur: OrgChartNode | null = n;
        while (cur) {
          keep.add(cur.id);
          cur = parentById.get(cur.id) ?? null;
        }
      }
    });
    return keep;
  }, [query, nodeById, parentById]);

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

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    const accent = TYPE_ACCENT[node.type];
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
          className="flex items-center gap-1.5"
          style={{
            paddingLeft: 10 + depth * 16,
            paddingRight: 10,
            height: 34,
            cursor: 'pointer',
            background: isOver
              ? 'rgba(0,84,202,0.06)'
              : isSelected
                ? 'rgba(63,44,128,0.06)'
                : 'transparent',
            borderLeft: `2px solid ${isSelected ? accent : 'transparent'}`,
          }}
          title={node.name}
        >
          {/* 펼침 토글(자식 있을 때만) */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.id);
              }}
              style={{ display: 'flex', color: T.grey500, flexShrink: 0 }}
              aria-label={open ? '접기' : '펼치기'}
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span style={{ width: 14, flexShrink: 0 }} />
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
              onDragEnd={() => {
                setDrag(null);
                setOverId(null);
              }}
              title="드래그해서 상위 조직을 바꿀 수 있어요"
              style={{ cursor: 'grab', color: T.grey400, display: 'flex', flexShrink: 0 }}
            >
              <GripVertical size={13} />
            </span>
          ) : (
            <span style={{ width: 4, flexShrink: 0 }} />
          )}
          {/* 타입 점 */}
          <span
            className="is-circle flex-shrink-0"
            style={{ width: 7, height: 7, background: accent, display: 'inline-block' }}
          />
          {/* 이름 */}
          <span
            style={{
              fontSize: 13,
              fontWeight: isSelected ? 700 : depth === 0 ? 600 : 500,
              color: isSelected ? T.grey900 : T.grey800,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {node.name}
          </span>
          {/* 인원 수 */}
          {count > 0 && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: T.grey500,
                marginLeft: 'auto',
                flexShrink: 0,
              }}
            >
              {count}
            </span>
          )}
        </div>
        {open && hasChildren && children.map((c) => renderTreeRow(c, depth + 1))}
      </div>
    );
  }

  // ── 우측 상세: 구성원 한 명(순수 렌더) ──
  function renderMember(user: User, isHead: boolean, deptType: OrgNodeType, deptId: string) {
    return (
      <div
        key={user.id}
        draggable={isAdmin}
        onDragStart={(e) => {
          setDrag({ kind: 'person', userId: user.id, name: user.name, fromDeptId: user.departmentId });
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => {
          setDrag(null);
          setOverId(null);
        }}
        title={isAdmin ? '드래그해서 다른 부서로 옮길 수 있어요' : undefined}
        className="flex items-center gap-2.5"
        style={{
          padding: '8px 12px',
          background: isHead ? 'rgba(63,44,128,0.05)' : K.white,
          border: `1px solid ${isHead ? 'rgba(63,44,128,0.25)' : K.outline}`,
          borderRadius: 8,
          cursor: isAdmin ? 'grab' : 'default',
          opacity: user.isActive ? 1 : 0.5,
        }}
      >
        {/* 아바타 */}
        <span
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: isHead ? K.primary : T.grey400,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {user.name.slice(0, 1)}
        </span>
        {/* 이름·직급 */}
        <div className="flex flex-col" style={{ minWidth: 0 }}>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>{user.name}</span>
            {isHead && (
              <span
                className="flex items-center gap-0.5"
                style={{ fontSize: 10, fontWeight: 700, color: K.primary }}
              >
                <Crown size={11} /> {HEAD_LABEL[deptType]}
              </span>
            )}
            {!user.isActive && (
              <span style={{ fontSize: 10, color: T.grey500 }}>(비활성)</span>
            )}
          </div>
          <span style={{ fontSize: 11.5, color: T.grey500 }}>
            {getPositionLabel(user.position, positions)}
            <span style={{ color: T.grey400 }}> · {roleLabel[user.role]}</span>
          </span>
        </div>
        {/* 부서장 지정/해제(관리자) */}
        {isAdmin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              void onSetHead(deptId, isHead ? '' : user.id);
            }}
            title={isHead ? `${HEAD_LABEL[deptType]} 지정을 해제해요` : `${HEAD_LABEL[deptType]}으로 지정해요`}
            className="flex items-center gap-1"
            style={{
              marginLeft: 'auto',
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 600,
              color: isHead ? K.primary : T.grey500,
              border: `1px solid ${isHead ? 'rgba(63,44,128,0.3)' : K.outline}`,
              borderRadius: 6,
              background: isHead ? 'rgba(63,44,128,0.05)' : 'transparent',
              padding: '3px 8px',
              cursor: 'pointer',
              transition: 'background .12s, border-color .12s',
            }}
          >
            <Crown size={12} /> {isHead ? '해제' : '부서장'}
          </button>
        )}
      </div>
    );
  }

  // ── 우측 상세 패널 ──
  function renderDetail(node: OrgChartNode) {
    const members = membersByDept.get(node.id) ?? [];
    const head = headOf(node, members);
    const children = node.children ?? [];
    const accent = TYPE_ACCENT[node.type];
    const droppable = canDrop(node);
    const isOver = overId === node.id && droppable;

    // 브레드크럼 경로(루트 → 현재).
    const path: OrgChartNode[] = [];
    let cur: OrgChartNode | null = node;
    while (cur) {
      path.unshift(cur);
      cur = parentById.get(cur.id) ?? null;
    }

    return (
      <div style={{ background: K.white, border: `1px solid ${K.outline}`, borderRadius: 12, boxShadow: CARD_SHADOW }}>
        {/* 상세 헤더 */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${K.outline}` }}>
          {/* 브레드크럼 */}
          {path.length > 1 && (
            <div className="flex items-center flex-wrap gap-1" style={{ marginBottom: 8 }}>
              {path.map((p, i) => (
                <span key={p.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={11} color={T.grey400} />}
                  <button
                    onClick={() => setSelectedId(p.id)}
                    style={{
                      fontSize: 11.5,
                      color: p.id === node.id ? T.grey700 : K.secondary,
                      fontWeight: p.id === node.id ? 700 : 400,
                      background: 'transparent',
                    }}
                  >
                    {p.name}
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              style={{
                width: 10, height: 10, background: accent, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 17, fontWeight: 700, color: T.grey900 }}>{node.name}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: accent,
                background: `${accent}18`,
                padding: '2px 9px',
                borderRadius: 999,
              }}
            >
              {ORG_TYPE_LABEL[node.type]}
            </span>
            {head ? (
              <span className="flex items-center gap-1" style={{ fontSize: 12.5, color: T.grey700 }}>
                <Crown size={13} color={K.primary} />
                {head.name} <span style={{ color: T.grey400 }}>{HEAD_LABEL[node.type]}</span>
              </span>
            ) : (
              <span style={{ fontSize: 12, color: T.grey400 }}>{HEAD_LABEL[node.type]} 미지정</span>
            )}
            <span
              className="flex items-center gap-1"
              style={{ fontSize: 12, color: T.grey500, marginLeft: 'auto' }}
            >
              <Users size={13} /> 직속 {members.length}명 · 전체 {node.totalCount}명
            </span>
          </div>

          {/* 관리자 액션 */}
          {isAdmin && (
            <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
              {node.type !== 'team' && (
                <button
                  onClick={() => onNodeAction('addChild', node)}
                  className="flex items-center gap-1"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#fff',
                    background: K.secondary,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,84,202,0.2)',
                  }}
                >
                  <Plus size={13} /> {node.type === 'group' ? '본부·팀 추가' : '팀 추가'}
                </button>
              )}
              <button
                onClick={() => onNodeAction('rename', node)}
                className="flex items-center gap-1"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.grey700,
                  background: K.white,
                  border: `1px solid ${K.outline}`,
                  borderRadius: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
              >
                <Pencil size={12} /> 이름 변경
              </button>
              <button
                onClick={() => onNodeAction('delete', node)}
                className="flex items-center gap-1"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#ba1a1a',
                  background: K.white,
                  border: `1px solid ${K.outline}`,
                  borderRadius: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={12} /> 삭제
              </button>
            </div>
          )}
        </div>

        {/* 직속 하위 조직 */}
        {children.length > 0 && (
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${K.outline}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.grey500, marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
              직속 하위 조직 {children.length}
            </div>
            <div className="flex flex-wrap gap-2">
              {children.map((c) => {
                const cAccent = TYPE_ACCENT[c.type];
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="flex items-center gap-2"
                    style={{
                      border: `1px solid ${K.outline}`,
                      borderLeft: `3px solid ${cAccent}`,
                      borderRadius: '0 8px 8px 0',
                      background: K.white,
                      padding: '7px 12px',
                      cursor: 'pointer',
                      transition: 'border-color .12s, background .12s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `rgba(63,44,128,0.3)`; (e.currentTarget as HTMLElement).style.background = K.surface; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = K.outline; (e.currentTarget as HTMLElement).style.background = K.white; }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: T.grey900 }}>{c.name}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: cAccent,
                        background: `${cAccent}18`,
                        padding: '1px 7px',
                        borderRadius: 999,
                      }}
                    >
                      {ORG_TYPE_LABEL[c.type]}
                    </span>
                    <span style={{ fontSize: 11, color: T.grey400 }}>{c.totalCount}명</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 구성원 — 이 부서 직속 멤버를 드롭 영역으로도 사용 */}
        <div
          style={{ padding: '14px 20px', background: isOver ? 'rgba(0,84,202,0.04)' : 'transparent' }}
          onDragOver={(e) => {
            if (droppable) {
              e.preventDefault();
              setOverId(node.id);
            }
          }}
          onDrop={(e) => {
            if (droppable) {
              e.preventDefault();
              void doDrop(node);
            }
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.grey500, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
              직속 구성원 {members.length}
            </span>
            {head && isAdmin && (
              <span style={{ fontSize: 11, color: T.grey400 }}>
                왕관 = 부서장 지정·해제
              </span>
            )}
          </div>
          {members.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 8,
              }}
            >
              {members.map((m) => renderMember(m, m.id === head?.id, node.type, node.id))}
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2"
              style={{
                padding: '32px 0',
                border: `1.5px dashed ${drag?.kind === 'person' ? K.secondary : K.outline}`,
                borderRadius: 10,
                color: drag?.kind === 'person' ? K.secondary : T.grey400,
                fontSize: 12.5,
                fontWeight: drag?.kind === 'person' ? 600 : 400,
                background: drag?.kind === 'person' ? 'rgba(0,84,202,0.03)' : 'transparent',
                transition: 'border-color .12s, background .12s',
              }}
            >
              <Users size={20} />
              {drag?.kind === 'person'
                ? '여기에 놓으면 이 부서로 옮겨져요'
                : '직속 구성원이 없어요'}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 빈 상태 ──
  if (groups.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3"
        style={{
          padding: 56,
          textAlign: 'center',
          color: T.grey500,
          fontSize: 13,
          background: K.white,
          border: `1px solid ${K.outline}`,
          borderRadius: 12,
          boxShadow: CARD_SHADOW,
        }}
      >
        <Building2 size={32} color={T.grey300} />
        <div>
          <p style={{ fontWeight: 600, color: T.grey700, marginBottom: 4 }}>조직이 아직 없어요.</p>
          <p style={{ color: T.grey400, fontSize: 12 }}>오른쪽 위 "그룹 추가"로 시작하세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 요약 바 */}
      <div
        className="flex items-center flex-wrap gap-2"
        style={{ background: K.white, border: `1px solid ${K.outline}`, borderRadius: 12, padding: '12px 20px', boxShadow: CARD_SHADOW }}
      >
        {[
          { label: '그룹', value: summary.g, color: K.primary },
          { label: '본부', value: summary.d, color: K.secondary },
          { label: '팀', value: summary.t, color: K.tertiary },
          { label: '소속 인원', value: summary.people, color: T.grey900 },
        ].map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            {i > 0 && <span style={{ width: 1, height: 16, background: K.outline }} />}
            <span
              className="is-circle"
              style={{ width: 7, height: 7, background: s.color, display: 'inline-block' }}
            />
            <span style={{ fontSize: 12, color: T.grey600 }}>{s.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.grey900 }}>{s.value}</span>
          </div>
        ))}
        {isAdmin && (
          <span style={{ fontSize: 11.5, color: T.grey400, marginLeft: 'auto' }}>
            트리에서 부서를 누르면 상세가 열려요. 드래그로 이동도 돼요.
          </span>
        )}
      </div>

      {/* 마스터-디테일 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 320px) 1fr',
          gap: 12,
          alignItems: 'start',
        }}
      >
        {/* 좌측: 트리 네비게이터 */}
        <div style={{ background: K.white, border: `1px solid ${K.outline}`, borderRadius: 12, boxShadow: CARD_SHADOW }}>
          {/* 검색 */}
          <div style={{ padding: 10, borderBottom: `1px solid ${K.outline}` }}>
            <div
              className="flex items-center gap-2"
              style={{
                border: `1px solid ${K.outline}`,
                padding: '7px 10px',
                background: K.surface,
                borderRadius: 8,
              }}
            >
              <Search size={14} color={T.grey400} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="부서 검색"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 12.5,
                  color: T.grey900,
                }}
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="검색 지우기" style={{ display: 'flex' }}>
                  <X size={13} color={T.grey400} />
                </button>
              )}
            </div>
          </div>
          {/* 트리 */}
          <div style={{ padding: '6px 0', maxHeight: 560, overflow: 'auto' }}>
            {visibleIds && visibleIds.size === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2" style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12.5, color: T.grey400 }}>
                <Search size={18} color={T.grey300} />
                <span>'{query}'에 맞는 부서가 없어요.</span>
              </div>
            ) : (
              groups.map((g) => renderTreeRow(g, 0))
            )}
          </div>
        </div>

        {/* 우측: 상세 */}
        {selectedNode ? (
          renderDetail(selectedNode)
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-2"
            style={{
              background: K.white,
              border: `1px solid ${K.outline}`,
              borderRadius: 12,
              padding: 56,
              color: T.grey400,
              fontSize: 13,
              boxShadow: CARD_SHADOW,
            }}
          >
            <Building2 size={24} color={T.grey300} />
            왼쪽에서 부서를 선택하세요.
          </div>
        )}
      </div>
    </div>
  );
}
