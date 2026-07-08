'use client';

// 조직 구조 탐색기 — 좌측 트리(네비)에서 부서를 고르면 우측 상세에 그 부서의
// 부서장·구성원·직속 하위조직이 펼쳐지는 마스터-디테일 레이아웃.
// 모든 부서를 한꺼번에 중첩 펼치던 기존 보드의 "정보 과부하"를 해소하고,
// 클릭 탐색을 1차 상호작용으로, 드래그&드롭(인원/부서 이동)은 보조 수단으로 둔다.
// 데이터: 부서 트리(OrgChartNode) + 사용자 목록(User[])을 프론트에서 부서별로 합성.
// 노드 행 렌더는 컴포넌트가 아니라 순수 렌더 함수로 한다 — 드래그 중 잦은 리렌더에도
// 펼침/선택 상태가 풀리거나 서브트리가 재마운트되지 않도록.
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Crown,
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  UserPlus,
  Building2,
  X,
} from 'lucide-react';
import type { OrgChartNode, User, PositionDef, OrgNodeType } from '@/lib/types';
import { getPositionLabel, roleLabel } from '@/lib/ui';
import { T } from '@/lib/palette';
import { Avatar } from './Avatar';

// Part 하이브리드 쿨 그레이 팔레트 — lib/palette.ts T 토큰 매핑.
const K = {
  primary:          T.grey900,
  primaryContainer: T.grey800,
  secondary:        T.blue500,
  secondaryDim:     T.grey600,
  tertiary:         T.grey500,
  surface:          T.grey50,
  surfaceLow:       T.grey100,
  white:            '#ffffff',
  outline:          T.grey200,
  outlineFull:      T.grey200,
} as const;
const CARD_SHADOW = 'none';

const ORG_TYPE_LABEL: Record<OrgNodeType, string> = {
  group: '그룹',
  division: '본부',
  team: '팀',
};

const HEAD_LABEL: Record<OrgNodeType, string> = {
  group: '그룹대표',
  division: '본부장',
  team: '팀장',
};

// 계층 깊이별 강조색: 대부분 잉크/그레이, 선택 신호만 블루.
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
              ? 'rgba(2,87,206,0.08)'
              : isSelected
                ? 'rgba(2,87,206,0.08)'
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
  function renderMember(
    user: User,
    isHead: boolean,
    isDeputy: boolean,
    deptType: OrgNodeType,
    deptId: string,
    isMatch: boolean,
  ) {
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
        // flexWrap: 버튼(부서장·부그룹장 최대 2개)이 안 들어가면 이름을 세로로 꺾지 말고
        // 버튼 묶음이 다음 줄로 내려가게 한다.
        className="flex flex-wrap items-center gap-2.5"
        style={{
          padding: '8px 12px',
          background: isHead || isMatch ? 'rgba(2,87,206,0.06)' : K.white,
          // 검색 매칭 구성원은 브랜드 블루 보더로 하이라이트(기존 알파 팔레트 재사용).
          border: `1px solid ${isMatch ? 'rgba(2,87,206,0.45)' : isHead ? 'rgba(2,87,206,0.24)' : K.outline}`,
          borderRadius: 8,
          cursor: isAdmin ? 'grab' : 'default',
          opacity: user.isActive ? 1 : 0.5,
        }}
      >
        {/* 아바타 */}
        <Avatar name={user.name} size="sm" />
        {/* 이름·직급 — nowrap+말줄임(글자 단위 세로 꺾임 방지). */}
        <div className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: T.grey900,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user.name}
            </span>
            {isHead && (
              <span
                className="flex items-center gap-0.5"
                style={{ fontSize: 10, fontWeight: 700, color: K.primary, whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <Crown size={11} /> {HEAD_LABEL[deptType]}
              </span>
            )}
            {isDeputy && !isHead && (
              <span
                className="flex items-center gap-0.5"
                style={{ fontSize: 10, fontWeight: 700, color: K.secondary, whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <Crown size={11} /> 부그룹장
              </span>
            )}
            {!user.isActive && (
              <span style={{ fontSize: 10, color: T.grey500, whiteSpace: 'nowrap', flexShrink: 0 }}>(비활성)</span>
            )}
          </div>
          <span
            style={{
              fontSize: 11.5,
              color: T.grey500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {getPositionLabel(user.position, positions)}
            <span style={{ color: T.grey400 }}> · {roleLabel[user.role]}</span>
          </span>
        </div>
        {/* 부서장·부그룹장 지정/해제(관리자) */}
        {isAdmin && (
          <div className="flex items-center gap-1" style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void onSetHead(deptId, isHead ? '' : user.id);
              }}
              title={isHead ? `${HEAD_LABEL[deptType]} 지정을 해제해요` : `${HEAD_LABEL[deptType]}으로 지정해요`}
              className="flex items-center gap-1"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: isHead ? K.primary : T.grey500,
                border: `1px solid ${isHead ? 'rgba(2,87,206,0.28)' : K.outline}`,
                borderRadius: 4,
                background: isHead ? 'rgba(2,87,206,0.06)' : 'transparent',
                padding: '3px 8px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background .12s, border-color .12s',
              }}
            >
              <Crown size={12} /> {isHead ? '해제' : HEAD_LABEL[deptType]}
            </button>
            {/* 부그룹장: 그룹에서만, 부서장이 아닌 구성원 대상. 팀장 2차·본부장 1차 평가자. */}
            {deptType === 'group' && onSetDeputyHead && !isHead && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void onSetDeputyHead(deptId, isDeputy ? '' : user.id);
                }}
                title={
                  isDeputy
                    ? '부그룹장 지정을 해제해요'
                    : '부그룹장으로 지정해요 (팀장 2차·본부장 1차 평가자)'
                }
                className="flex items-center gap-1"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: isDeputy ? K.secondary : T.grey500,
                  border: `1px solid ${isDeputy ? 'rgba(2,87,206,0.28)' : K.outline}`,
                  borderRadius: 4,
                  background: isDeputy ? 'rgba(2,87,206,0.06)' : 'transparent',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background .12s, border-color .12s',
                }}
              >
                <Crown size={12} /> {isDeputy ? '해제' : '부그룹장'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── 우측 상세 패널 ──
  function renderDetail(node: OrgChartNode) {
    const members = membersByDept.get(node.id) ?? [];
    const head = headOf(node);
    // 부그룹장은 명시 지정만(자동 추론 없음). 그룹 외 타입은 항상 null.
    const deputy =
      node.type === 'group' && node.deputyHeadUserId
        ? members.find((m) => m.id === node.deputyHeadUserId) ?? null
        : null;
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
      // 좌측 트리와 동일하게 뷰포트 연동 높이 — 넘치면 상세 내부 스크롤.
      <div style={{ background: K.white, border: `1px solid ${K.outline}`, borderRadius: 10, overflowX: 'hidden', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', boxShadow: CARD_SHADOW }}>
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
              // B-1: 부서장 미지정 = 이 조직 계층의 평가 단계가 비어 상위가 대신 평가 — warning 톤으로 승격.
              <span
                className="inline-flex items-center gap-1 rounded-sm border border-warning-300 bg-warning-50 px-2 py-0.5 text-[11px] font-bold text-warning-700"
                title="부서장이 지정되지 않아 이 단계 평가는 상위 부서장이 맡아요. 구성원의 왕관 버튼으로 지정하세요."
              >
                <AlertTriangle size={11} aria-hidden /> {HEAD_LABEL[node.type]} 미지정
              </span>
            )}
            {deputy && (
              <span className="flex items-center gap-1" style={{ fontSize: 12.5, color: T.grey700 }}>
                <Crown size={13} color={K.secondary} />
                {deputy.name} <span style={{ color: T.grey400 }}>부그룹장</span>
              </span>
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
              {/* 구성원 추가 — 본부/팀 선택 시 주요 액션(블루 solid, 브리프 §4). 기존 배치 API(PersonEditModal) 재사용. */}
              {onAddMember && node.type !== 'group' && (
                <button
                  onClick={() => onAddMember(node)}
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
                  }}
                >
                  <UserPlus size={13} /> 구성원 추가
                </button>
              )}
              {node.type !== 'team' && (
                <button
                  onClick={() => onNodeAction('addChild', node)}
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
                  color: T.grey400,
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
                      borderRadius: 8,
                      background: K.white,
                      padding: '7px 12px',
                      cursor: 'pointer',
                      transition: 'border-color .12s, background .12s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `rgba(2,87,206,0.28)`; (e.currentTarget as HTMLElement).style.background = K.surface; }}
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
          style={{ padding: '14px 20px', background: isOver ? 'rgba(2,87,206,0.05)' : 'transparent' }}
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
            {isAdmin && (
              <span style={{ fontSize: 11, color: T.grey400 }}>
                왕관 = 부서장 지정·해제
              </span>
            )}
          </div>
          {members.length > 0 ? (
            <div
              style={{
                display: 'grid',
                // 카드 최소 폭: 이름·배지 + 버튼 2개(부서장·부그룹장)가 한 줄에 여유 있게 들어가는 폭.
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 8,
              }}
            >
              {members.map((m) =>
                renderMember(
                  m,
                  m.id === head?.id,
                  m.id === deputy?.id,
                  node.type,
                  node.id,
                  !!trimmedQuery && m.name.toLowerCase().includes(trimmedQuery),
                ),
              )}
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2"
              style={{
                padding: '32px 0',
                border: `1.5px dashed ${drag?.kind === 'person' ? K.secondary : K.outline}`,
                borderRadius: 8,
                color: drag?.kind === 'person' ? K.secondary : T.grey400,
                fontSize: 12.5,
                fontWeight: drag?.kind === 'person' ? 600 : 400,
                background: drag?.kind === 'person' ? 'rgba(2,87,206,0.04)' : 'transparent',
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
          borderRadius: 10,
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
        style={{ padding: '4px 2px 8px' }}
      >
        {[
          { label: '그룹', value: summary.g, color: K.primary },
          { label: '본부', value: summary.d, color: K.secondary },
          { label: '팀', value: summary.t, color: K.tertiary },
          { label: '소속 인원', value: summary.people, color: T.grey900 },
        ].map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            {i > 0 && <span style={{ color: T.grey400, fontSize: 12 }}>/</span>}
            <span
              className="is-circle"
              style={{ width: 5, height: 5, background: s.color, display: 'inline-block' }}
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
        <div style={{ background: K.white, border: `1px solid ${K.outline}`, borderRadius: 10, overflow: 'hidden', boxShadow: CARD_SHADOW }}>
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
                placeholder="부서·구성원 이름 검색"
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
          {/* 트리 — 560px 고정 대신 뷰포트 연동(검색바 높이만큼 상세보다 짧게). */}
          <div style={{ padding: '6px 0', maxHeight: 'calc(100vh - 340px)', minHeight: 240, overflow: 'auto' }}>
            {visibleIds && visibleIds.size === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2" style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12.5, color: T.grey400 }}>
                <Search size={18} color={T.grey300} />
                <span>'{query}'에 맞는 부서·구성원이 없어요.</span>
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
              borderRadius: 10,
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
