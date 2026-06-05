'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Users,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgChart } from '@/hooks/useOrgChart';
import { useUsers, userCommands } from '@/hooks/useUsers';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { departmentCommands } from '@/hooks/useDepartments';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import {
  OrgNodeModal,
  type OrgNodeModalMode,
} from '@/components/OrgNodeModal';
import {
  PersonEditModal,
  type PersonEditDraft,
} from '@/components/PersonEditModal';
import { ErrorState } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import {
  flattenOrg,
  deptPath,
  defaultRoleForPosition,
  defaultScopeForPosition,
} from '@/lib/org';
import type {
  User,
  Position,
  OrgChartNode,
  OrgNodeType,
  CreateUserRequest,
  UpdateUserRequest,
} from '@/lib/types';
import { T } from '@/lib/toss';

const FONT = 'Pretendard, sans-serif';

const TYPE_LABEL: Record<OrgNodeType, string> = {
  group: '그룹',
  division: '본부',
  team: '팀',
};

/* ── 조직 노드 카드(그룹→본부→팀 트리) ── */
function OrgNodeCard({
  node,
  level = 0,
  editable,
  onAction,
}: {
  node: OrgChartNode;
  level?: number;
  editable?: boolean;
  onAction?: (action: 'rename' | 'addChild' | 'delete', node: OrgChartNode) => void;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const avatarBg = level === 0 ? T.blue500 : level === 1 ? T.grey800 : T.grey700;
  const accentBorder =
    level === 0
      ? `3px solid ${T.blue500}`
      : level === 1
        ? `3px solid ${T.grey800}`
        : `1px solid ${T.grey200}`;

  return (
    <div className="flex flex-col items-center">
      <div
        style={{
          background: '#fff',
          border: `1px solid ${T.grey200}`,
          borderTop: accentBorder,
          padding: 12,
          minWidth: 140,
          maxWidth: 160,
          cursor: hasChildren ? 'pointer' : 'default',
          position: 'relative',
        }}
        onClick={() => hasChildren && setExpanded((v) => !v)}
      >
        <span
          style={{
            position: 'absolute',
            top: -10,
            right: -8,
            fontSize: 10,
            fontWeight: 700,
            background: avatarBg,
            color: '#fff',
            padding: '1px 6px',
          }}
        >
          {node.totalCount}명
        </span>
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="flex items-center justify-center text-white"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: avatarBg,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {node.name[0]}
          </div>
          <div className="text-center">
            <div style={{ fontSize: 12, fontWeight: 700, color: T.grey900 }}>
              {node.name}
            </div>
            <div style={{ fontSize: 10.5, color: T.grey600, marginTop: 1 }}>
              {TYPE_LABEL[node.type]}
            </div>
            <div style={{ fontSize: 10, color: T.grey500 }}>
              직속 {node.directCount}명
            </div>
          </div>
        </div>
        {editable && onAction && (
          <div
            className="flex justify-center gap-1.5"
            style={{ marginTop: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            {node.type !== 'team' && (
              <button
                onClick={() => onAction('addChild', node)}
                style={{ fontSize: 10, color: T.blue500, fontWeight: 600 }}
              >
                + 하위
              </button>
            )}
            <button
              onClick={() => onAction('rename', node)}
              style={{ fontSize: 10, color: T.grey500 }}
            >
              이름
            </button>
            <button
              onClick={() => onAction('delete', node)}
              style={{ fontSize: 10, color: T.red500 }}
            >
              삭제
            </button>
          </div>
        )}
        {hasChildren && (
          <div className="flex justify-center" style={{ marginTop: 6 }}>
            {expanded ? (
              <ChevronDown size={12} color={T.grey500} />
            ) : (
              <ChevronRight size={12} color={T.grey500} />
            )}
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div style={{ position: 'relative', marginTop: 0 }}>
          <div className="flex justify-center" style={{ height: 24 }}>
            <div style={{ width: 1.5, background: T.grey200, height: '100%' }} />
          </div>
          <div style={{ position: 'relative' }}>
            <div className="flex justify-center" style={{ gap: 16 }}>
              {children.map((child) => (
                <div key={child.id} className="flex flex-col items-center relative">
                  <div
                    style={{
                      height: 20,
                      width: 1.5,
                      background: T.grey200,
                      margin: '0 auto',
                    }}
                  />
                  <OrgNodeCard
                    node={child}
                    level={level + 1}
                    editable={editable}
                    onAction={onAction}
                  />
                </div>
              ))}
            </div>
            {children.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  height: 1.5,
                  background: T.grey200,
                  width: `${(children.length - 1) * (160 + 16)}px`,
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 가시성 설정 데이터 (디자인 mock — 권한 정책 안내) ── */
type VisScope = '전체' | '그룹' | '본부' | '팀' | '본인';
type SensitiveField = '매출' | '등급' | 'KPI점수' | '평가의견';

type RoleVis = {
  role: string;
  title: string;
  scope: VisScope;
  sensitive: Partial<Record<SensitiveField, boolean>>;
  note: string;
};

const visibilityRules: RoleVis[] = [
  {
    role: 'hr-admin',
    title: '인사총무팀 (관리자)',
    scope: '전체',
    sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: true },
    note: '전 조직 전체 열람·수정 가능',
  },
  {
    role: 'ceo',
    title: '대표이사',
    scope: '전체',
    sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: false },
    note: '그룹 전체 집계 열람',
  },
  {
    role: 'division-head',
    title: '본부장',
    scope: '본부',
    sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: true },
    note: '소속 본부만 열람, 타 본부 차단',
  },
  {
    role: 'team-lead',
    title: '팀장',
    scope: '팀',
    sensitive: { 매출: false, 등급: true, KPI점수: true, 평가의견: true },
    note: '소속 팀만 열람, 매출 집계 제한',
  },
  {
    role: 'member',
    title: '팀원',
    scope: '본인',
    sensitive: { 매출: false, 등급: false, KPI점수: true, 평가의견: false },
    note: '본인 데이터만 열람 가능',
  },
];

const scopeColor: Record<VisScope, string> = {
  전체: T.blue500,
  그룹: '#9333EA',
  본부: T.orange500,
  팀: T.green500,
  본인: T.grey700,
};

const sensitiveFields: SensitiveField[] = ['매출', '등급', 'KPI점수', '평가의견'];

function VisibilityView() {
  const [rules, setRules] = useState(visibilityRules);

  const toggle = (roleId: string, field: SensitiveField) => {
    setRules((prev) =>
      prev.map((r) =>
        r.role === roleId
          ? { ...r, sensitive: { ...r.sensitive, [field]: !r.sensitive[field] } }
          : r,
      ),
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 범위 범례 */}
      <div style={{ background: '#fff', border: `1px solid ${T.grey200}`, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.grey900, marginBottom: 14 }}>
          조직별 보기 범위 기준
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {(['전체', '그룹', '본부', '팀', '본인'] as VisScope[]).map((s) => {
            const c = scopeColor[s];
            const desc: Record<VisScope, string> = {
              전체: '인사총무팀·대표이사\n전 조직 열람',
              그룹: '그룹 대표\n소속 그룹 전체',
              본부: '본부장\n소속 본부만',
              팀: '팀장\n소속 팀만',
              본인: '팀원\n본인 데이터만',
            };
            return (
              <div key={s} style={{ border: `1px solid ${T.grey200}`, borderTop: `3px solid ${c}` }}>
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{s}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: T.grey600,
                      marginTop: 4,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {desc[s]}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderLeft: `2px solid ${T.red500}`,
            background: '#fafafa',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: T.red500, marginBottom: 2 }}>
            경쟁 구조 보호
          </div>
          <div style={{ fontSize: 11.5, color: T.grey600 }}>
            본부끼리·팀끼리는 서로의 데이터를 열람할 수 없습니다. 매출·등급 등
            민감정보는 자기 범위 내에서만 공개되며, 상위 직급이 통제권을 갖습니다.
          </div>
        </div>
      </div>

      {/* 민감정보 접근 매트릭스 */}
      <div style={{ background: '#fff', border: `1px solid ${T.grey200}`, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.grey200}`, background: T.grey50 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.grey900 }}>
            민감정보 접근 권한 매트릭스
          </div>
          <div style={{ fontSize: 11.5, color: T.grey600, marginTop: 2 }}>
            인사총무팀이 직급·직책 단위로 수동 설정합니다.
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '220px 80px 1fr',
            padding: '12px 20px',
            borderBottom: `1px solid ${T.grey200}`,
            background: T.grey50,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>직급/직책</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>범위</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sensitiveFields.length}, 1fr)` }}>
            {sensitiveFields.map((f) => (
              <div key={f} style={{ fontSize: 11, fontWeight: 600, color: T.grey600, textAlign: 'center' }}>
                {f}
              </div>
            ))}
          </div>
        </div>
        {rules.map((r) => {
          const isAdmin = r.role === 'hr-admin';
          return (
            <div
              key={r.role}
              style={{
                display: 'grid',
                gridTemplateColumns: '220px 80px 1fr',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: `1px solid ${T.grey200}`,
                background: isAdmin ? T.grey50 : 'transparent',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: isAdmin ? 700 : 500, color: T.grey900 }}>
                  {r.title}
                </div>
                <div style={{ fontSize: 11, color: T.grey500, marginTop: 1 }}>{r.note}</div>
              </div>
              <div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: scopeColor[r.scope],
                    color: '#fff',
                    padding: '2px 8px',
                  }}
                >
                  {r.scope}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sensitiveFields.length}, 1fr)` }}>
                {sensitiveFields.map((field) => {
                  const allowed = !!r.sensitive[field];
                  return (
                    <div key={field} className="flex justify-center">
                      <button
                        onClick={() => !isAdmin && toggle(r.role, field)}
                        style={{ cursor: isAdmin ? 'default' : 'pointer' }}
                      >
                        {isAdmin ? (
                          <Eye size={16} color={T.blue500} />
                        ) : allowed ? (
                          <Eye size={16} color={T.green500} />
                        ) : (
                          <EyeOff size={16} color={T.grey400} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 차단 구조 */}
      <div style={{ background: '#fff', border: `1px solid ${T.grey200}`, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.grey900, marginBottom: 14 }}>
          본부 간·팀 간 격리 구조
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { title: '본부 간 격리', items: ['전략기획본부', '기술본부', 'HR본부', '영업본부'], color: T.grey800 },
            { title: '팀 간 격리 (예: 기술본부)', items: ['개발팀', '인프라팀', 'QA팀'], color: T.grey700 },
          ].map((group, gi) => (
            <div key={gi} style={{ border: `1px solid ${T.grey200}`, padding: 16 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <Lock size={13} color={group.color} />
                <span style={{ fontSize: 12, fontWeight: 600, color: group.color }}>
                  {group.title}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item, ii) => (
                  <div
                    key={ii}
                    style={{
                      border: `1px solid ${T.grey200}`,
                      padding: '8px 12px',
                      fontSize: 12,
                      color: T.grey700,
                      fontWeight: 500,
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5" style={{ marginTop: 12 }}>
                <EyeOff size={11} color={T.red500} />
                <span style={{ fontSize: 11, color: T.red500 }}>각 단위는 상호 열람 불가</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 목록 뷰: 그룹/본부별 통계(실데이터) ── */
function ListView({ chart }: { chart: OrgChartNode | null }) {
  // 회사 루트의 직속 자식(그룹)을 행으로.
  const rows = useMemo(() => {
    const groups = chart?.children ?? [];
    return groups.flatMap((g) => {
      const divisions = g.children ?? [];
      if (divisions.length === 0) {
        return [{ id: g.id, dept: g.name, type: g.type, members: g.totalCount }];
      }
      return [
        { id: g.id, dept: g.name, type: g.type, members: g.totalCount },
        ...divisions.map((d) => ({
          id: d.id,
          dept: `└ ${d.name}`,
          type: d.type,
          members: d.totalCount,
        })),
      ];
    });
  }, [chart]);

  return (
    <div style={{ background: '#fff', border: `1px solid ${T.grey200}`, overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr',
          padding: '12px 20px',
          borderBottom: `1px solid ${T.grey200}`,
          background: T.grey50,
        }}
      >
        {['조직', '유형', '인원'].map((h) => (
          <div key={h} style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>
            {h}
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: T.grey500 }}>
          조직이 아직 없어요.
        </div>
      ) : (
        rows.map((d) => (
          <div
            key={d.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              alignItems: 'center',
              padding: '12px 20px',
              borderBottom: `1px solid ${T.grey200}`,
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center"
                style={{ width: 28, height: 28, background: T.blue500 }}
              >
                <Users size={13} color="#fff" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>{d.dept}</span>
            </div>
            <div style={{ fontSize: 12.5, color: T.grey700 }}>{TYPE_LABEL[d.type]}</div>
            <div style={{ fontSize: 12.5, color: T.grey700 }}>{d.members}명</div>
          </div>
        ))
      )}
    </div>
  );
}

export default function OrgPage() {
  const { user } = useAuth();
  const toast = useToast();
  const editable = !!user && isHrAdmin(user.role);

  const {
    data: chart,
    loading: chartLoading,
    error: chartError,
    reload: reloadChart,
  } = useOrgChart({ enabled: !!user });

  const {
    data: usersData,
    reload: reloadUsers,
  } = useUsers({ includeInactive: true, pageSize: 500 }, { enabled: !!user });

  const [view, setView] = useState<'chart' | 'list' | 'visibility'>('chart');

  // 모달 상태
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [nodeModalMode, setNodeModalMode] = useState<OrgNodeModalMode>('create');
  const [nodeParent, setNodeParent] = useState<OrgChartNode | null>(null);
  const [nodeTarget, setNodeTarget] = useState<OrgChartNode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgChartNode | null>(null);
  const [nodeDeleting, setNodeDeleting] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [personMode, setPersonMode] = useState<'create' | 'edit'>('create');
  const [personDraft, setPersonDraft] = useState<PersonEditDraft | null>(null);
  const [personErrors, setPersonErrors] = useState<
    Partial<Record<keyof PersonEditDraft, string>>
  >({});
  const [personSaving, setPersonSaving] = useState(false);

  const flat = useMemo(() => flattenOrg(chart), [chart]);

  const orgOptions = useMemo(() => {
    const groups: { id: string; name: string }[] = [];
    const divisions: { id: string; name: string; groupId: string }[] = [];
    const teams: { id: string; name: string; parentId: string }[] = [];
    flat.forEach((n) => {
      if (n.type === 'group') groups.push({ id: n.id, name: n.name });
      else if (n.type === 'division')
        divisions.push({ id: n.id, name: n.name, groupId: n.parentId ?? '' });
      else if (n.type === 'team')
        teams.push({ id: n.id, name: n.name, parentId: n.parentId ?? '' });
    });
    return { groups, divisions, teams };
  }, [flat]);

  // ── 구성원 추가 ──
  function openCreate() {
    const firstGroup = orgOptions.groups[0]?.id ?? '';
    const position: Position = 'pro';
    setPersonMode('create');
    setPersonErrors({});
    setPersonDraft({
      name: '',
      email: '',
      groupId: firstGroup,
      divisionId: null,
      teamId: null,
      position,
      role: defaultRoleForPosition(position),
      visibilityScope: defaultScopeForPosition(position),
      roleOverride: false,
      scopeOverride: false,
    });
    setPersonOpen(true);
  }

  async function savePerson() {
    if (!personDraft) return;
    const errs: Partial<Record<keyof PersonEditDraft, string>> = {};
    if (!personDraft.name.trim()) errs.name = '이름을 입력해 주세요.';
    if (personMode === 'create' && !personDraft.email.trim())
      errs.email = '이메일을 입력해 주세요.';
    if (!personDraft.groupId) errs.groupId = '소속 그룹을 선택해 주세요.';
    if (Object.keys(errs).length > 0) {
      setPersonErrors(errs);
      return;
    }
    const departmentId =
      personDraft.teamId ?? personDraft.divisionId ?? personDraft.groupId;
    setPersonSaving(true);
    try {
      if (personMode === 'create') {
        const body: CreateUserRequest = {
          email: personDraft.email.trim(),
          name: personDraft.name.trim(),
          position: personDraft.position,
          departmentId,
          role: personDraft.roleOverride ? personDraft.role : undefined,
          visibilityScope: personDraft.scopeOverride
            ? personDraft.visibilityScope
            : undefined,
        };
        await userCommands.create(body);
        toast.show({ variant: 'success', message: '구성원을 추가했어요.' });
      } else if (personDraft.id) {
        const body: UpdateUserRequest = {
          name: personDraft.name.trim(),
          position: personDraft.position,
          departmentId,
          role: personDraft.role,
          visibilityScope: personDraft.visibilityScope,
        };
        await userCommands.update(personDraft.id, body);
        toast.show({ variant: 'success', message: '구성원을 수정했어요.' });
      }
      setPersonOpen(false);
      setPersonDraft(null);
      reloadChart();
      reloadUsers();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_EXISTS') {
        setPersonErrors({ email: '이미 등록된 이메일이에요.' });
      } else {
        toast.show({
          variant: 'danger',
          message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
        });
      }
    } finally {
      setPersonSaving(false);
    }
  }

  // ── 조직 노드 CRUD ──
  function openAddRoot() {
    setNodeModalMode('create');
    setNodeParent(null);
    setNodeTarget(null);
    setNodeModalOpen(true);
  }

  function handleNodeAction(
    action: 'rename' | 'addChild' | 'delete',
    node: OrgChartNode,
  ) {
    if (action === 'rename') {
      setNodeModalMode('rename');
      setNodeTarget(node);
      setNodeParent(null);
      setNodeModalOpen(true);
    } else if (action === 'addChild') {
      if (node.type === 'team') {
        toast.show({ variant: 'info', message: '팀 아래에는 더 추가할 수 없어요.' });
        return;
      }
      setNodeModalMode('create');
      setNodeParent(node);
      setNodeTarget(null);
      setNodeModalOpen(true);
    } else if (action === 'delete') {
      setDeleteTarget(node);
    }
  }

  async function submitNode(data: {
    name: string;
    type: OrgNodeType;
    parentId?: string;
  }) {
    try {
      if (nodeModalMode === 'create') {
        await departmentCommands.create({
          name: data.name,
          type: data.type,
          parentId: data.parentId,
        });
        toast.show({ variant: 'success', message: '조직을 추가했어요.' });
      } else if (nodeTarget) {
        await departmentCommands.rename(nodeTarget.id, data.name);
        toast.show({ variant: 'success', message: '이름을 변경했어요.' });
      }
      setNodeModalOpen(false);
      setNodeParent(null);
      setNodeTarget(null);
      reloadChart();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    }
  }

  async function confirmDeleteNode() {
    if (!deleteTarget) return;
    setNodeDeleting(true);
    try {
      await departmentCommands.remove(deleteTarget.id);
      toast.show({ variant: 'success', message: '조직을 삭제했어요.' });
      setDeleteTarget(null);
      reloadChart();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '삭제에 실패했어요.',
      });
    } finally {
      setNodeDeleting(false);
    }
  }

  if (!user) return null;
  if (chartError)
    return <ErrorState onRetry={reloadChart} message="조직도를 불러오지 못했어요." />;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, fontFamily: FONT }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.grey900 }}>조직도</h1>
          <p style={{ fontSize: 13, color: T.grey600, marginTop: 2 }}>
            {chart
              ? `${chart.name} 임직원 ${chart.totalCount}명 · 평가 대상자 구성`
              : '에너지엑스 조직 현황 및 평가 대상자 구성'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {editable && view === 'chart' && (
            <Button onClick={openCreate} size="sm">
              구성원 추가 +
            </Button>
          )}
          <div className="flex" style={{ border: `1px solid ${T.grey200}`, overflow: 'hidden' }}>
            {(['chart', 'list', 'visibility'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 500,
                  background: view === v ? T.grey900 : '#fff',
                  color: view === v ? '#fff' : T.grey700,
                  borderRight: v !== 'visibility' ? `1px solid ${T.grey200}` : 'none',
                }}
              >
                {v === 'chart' ? '조직도' : v === 'list' ? '목록' : '가시성 설정'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'chart' && (
        <div
          style={{
            background: '#fff',
            border: `1px solid ${T.grey200}`,
            padding: 32,
            overflowX: 'auto',
          }}
        >
          {chartLoading && !chart ? (
            <div style={{ textAlign: 'center', padding: 32, color: T.grey500, fontSize: 13 }}>
              불러오는 중…
            </div>
          ) : !chart ? (
            <div style={{ textAlign: 'center', padding: 32, color: T.grey500, fontSize: 13 }}>
              조직이 아직 없어요.
              {editable && (
                <div style={{ marginTop: 12 }}>
                  <Button size="sm" onClick={openAddRoot}>
                    그룹 추가
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center" style={{ minWidth: 'max-content' }}>
              <OrgNodeCard
                node={chart}
                level={0}
                editable={editable}
                onAction={handleNodeAction}
              />
            </div>
          )}
        </div>
      )}

      {view === 'list' && <ListView chart={chart} />}

      {view === 'visibility' && <VisibilityView />}

      {/* 조직 노드 추가/이름변경 */}
      <OrgNodeModal
        open={nodeModalOpen}
        mode={nodeModalMode}
        parentNode={nodeParent}
        targetNode={nodeTarget}
        onClose={() => {
          setNodeModalOpen(false);
          setNodeParent(null);
          setNodeTarget(null);
        }}
        onSubmit={submitNode}
      />

      {/* 조직 노드 삭제 확인 */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="조직을 삭제할까요?"
        primaryAction={{
          label: '삭제',
          variant: 'danger',
          loading: nodeDeleting,
          onClick: () => void confirmDeleteNode(),
        }}
        secondaryAction={{ label: '취소', onClick: () => setDeleteTarget(null) }}
      >
        {deleteTarget?.name} 을(를) 삭제하면 되돌릴 수 없어요. 구성원이나 하위
        조직이 있으면 삭제할 수 없으니, 먼저 옮기거나 비워 주세요.
      </Modal>

      {/* 구성원 추가/수정 */}
      {personDraft && (
        <PersonEditModal
          open={personOpen}
          mode={personMode}
          value={personDraft}
          groups={orgOptions.groups}
          divisions={orgOptions.divisions}
          teams={orgOptions.teams}
          errors={personErrors}
          saving={personSaving}
          onChange={(patch) =>
            setPersonDraft((d) => (d ? { ...d, ...patch } : d))
          }
          onSubmit={() => void savePerson()}
          onClose={() => {
            setPersonOpen(false);
            setPersonDraft(null);
          }}
        />
      )}
    </div>
  );
}
