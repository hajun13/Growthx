'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Users, Eye, EyeOff, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUsers, userCommands } from '@/hooks/useUsers';
import { usePositions } from '@/hooks/usePositions';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { departmentCommands } from '@/hooks/useDepartments';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { OrgNodeModal, type OrgNodeModalMode } from '@/components/OrgNodeModal';
import { PersonEditModal, type PersonEditDraft } from '@/components/PersonEditModal';
import { ErrorState, EmptyState, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { SegmentedControl } from '@/components/SegmentedControl';
import { isHrAdmin } from '@/lib/nav';
import {
  flattenOrg,
  defaultRoleForPosition,
  defaultScopeForPosition,
} from '@/lib/org';
import type {
  Position,
  OrgChartNode,
  OrgNodeType,
  CreateUserRequest,
  UpdateUserRequest,
} from '@/lib/types';
import { useOrgChartData } from '../hooks';

const TYPE_LABEL: Record<OrgNodeType, string> = {
  group: '그룹',
  division: '본부',
  team: '팀',
};

// 레벨별 Tailwind 색 클래스 (그룹=primary, 본부=primary/dim, 팀=info)
const LEVEL_BG = ['bg-primary', 'bg-purple-600', 'bg-info-500'] as const;
const LEVEL_TEXT = ['text-primary', 'text-purple-600', 'text-info-700'] as const;

/* ── 조직 노드 카드 ── */
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
  const bgCls = LEVEL_BG[Math.min(level, LEVEL_BG.length - 1)];
  const textCls = LEVEL_TEXT[Math.min(level, LEVEL_TEXT.length - 1)];

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative bg-card border border-border/50 border-t-[3px] rounded-b-lg shadow-elev-1 transition-shadow hover:shadow-elev-2 p-3.5"
        style={{ minWidth: 144, maxWidth: 168 }}
      >
        {/* 인원 배지 */}
        <span
          className={`absolute -top-2.5 -right-2 text-[10px] font-bold text-white px-2 py-0.5 rounded-pill ${bgCls}`}
        >
          {node.totalCount}명
        </span>

        <div
          className={`flex flex-col items-center gap-1.5 ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
          onClick={() => hasChildren && setExpanded((v) => !v)}
        >
          {/* 아바타 */}
          <div
            className={`flex items-center justify-center text-white rounded-full text-sm font-bold w-9 h-9 ${bgCls}`}
          >
            {node.name[0]}
          </div>
          <div className="text-center">
            <div className="text-[12.5px] font-bold text-foreground">{node.name}</div>
            <div className={`text-[10.5px] font-semibold mt-0.5 ${textCls}`}>
              {TYPE_LABEL[node.type]}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              직속 {node.directCount}명
            </div>
          </div>
        </div>

        {/* 편집 버튼 */}
        {editable && onAction && (
          <div
            className="flex justify-center gap-1.5 mt-2"
            onClick={(e) => e.stopPropagation()}
          >
            {node.type !== 'team' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction('addChild', node)}
                className="text-[10px] h-auto py-0.5 px-1.5"
              >
                + 하위
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAction('rename', node)}
              className="text-[10px] h-auto py-0.5 px-1.5 text-muted-foreground"
            >
              이름
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAction('delete', node)}
              className="text-[10px] h-auto py-0.5 px-1.5 text-danger-600"
            >
              삭제
            </Button>
          </div>
        )}

        {hasChildren && (
          <div className="flex justify-center mt-1.5">
            {expanded
              ? <ChevronDown size={12} className="text-muted-foreground" />
              : <ChevronRight size={12} className="text-muted-foreground" />}
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="relative">
          <div className="flex justify-center h-6">
            <div className="w-0.5 h-full bg-border/50" />
          </div>
          <div className="relative">
            <div className="flex justify-center gap-4">
              {children.map((child) => (
                <div key={child.id} className="flex flex-col items-center relative">
                  <div className="h-5 w-0.5 bg-border/50 mx-auto" />
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
                className="absolute top-0 h-0.5 bg-border/50"
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: `${(children.length - 1) * (168 + 16)}px`,
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 가시성 설정 ── */
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
  { role: 'hr-admin',      title: '인사총무팀 (관리자)', scope: '전체', sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: true  }, note: '전 조직 전체 열람·수정 가능' },
  { role: 'ceo',           title: '대표이사',            scope: '전체', sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: false }, note: '그룹 전체 집계 열람' },
  { role: 'division-head', title: '본부장',              scope: '본부', sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: true  }, note: '소속 본부만 열람, 타 본부 차단' },
  { role: 'team-lead',     title: '팀장',                scope: '팀',   sensitive: { 매출: false, 등급: true, KPI점수: true, 평가의견: true  }, note: '소속 팀만 열람, 매출 집계 제한' },
  { role: 'member',        title: '팀원',                scope: '본인', sensitive: { 매출: false, 등급: false, KPI점수: true, 평가의견: false }, note: '본인 데이터만 열람 가능' },
];

const SCOPE_TEXT_CLS: Record<VisScope, string> = {
  전체: 'text-primary',
  그룹: 'text-purple-700',
  본부: 'text-purple-600',
  팀: 'text-info-700',
  본인: 'text-muted-foreground',
};

const SCOPE_BG_CLS: Record<VisScope, string> = {
  전체: 'bg-primary text-white',
  그룹: 'bg-purple-700 text-white',
  본부: 'bg-purple-600 text-white',
  팀: 'bg-info-500 text-white',
  본인: 'bg-neutral-500 text-white',
};

const sensitiveFields: SensitiveField[] = ['매출', '등급', 'KPI점수', '평가의견'];

const SCOPE_DESC: Record<VisScope, string> = {
  전체: '인사총무팀·대표이사\n전 조직 열람',
  그룹: '그룹 대표\n소속 그룹 전체',
  본부: '본부장\n소속 본부만',
  팀: '팀장\n소속 팀만',
  본인: '팀원\n본인 데이터만',
};

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
    <div className="space-y-5">
      {/* 범위 범례 */}
      <Card title="조직별 보기 범위 기준">
        <div className="grid grid-cols-5 gap-3">
          {(['전체', '그룹', '본부', '팀', '본인'] as VisScope[]).map((s) => (
            <div key={s} className="border border-border/50 border-t-[3px] rounded-b-lg">
              <div className="p-3">
                <div className={`text-[13px] font-bold ${SCOPE_TEXT_CLS[s]}`}>{s}</div>
                <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
                  {SCOPE_DESC[s]}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 border-l-4 border-danger-500 bg-danger-50 rounded-r-md">
          <div className="text-[12px] font-bold text-danger-700 mb-1">경쟁 구조 보호</div>
          <div className="text-[11.5px] text-danger-700">
            본부끼리·팀끼리는 서로의 데이터를 열람할 수 없습니다. 매출·등급 등
            민감정보는 자기 범위 내에서만 공개되며, 상위 직급이 통제권을 갖습니다.
          </div>
        </div>
      </Card>

      {/* 민감정보 접근 매트릭스 */}
      <Card title="민감정보 접근 권한 매트릭스" padding="sm">
        {/* 헤더 행 */}
        <div className="grid items-center px-4 py-2 bg-muted border-b border-border"
          style={{ gridTemplateColumns: '220px 80px 1fr' }}>
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">직급/직책</div>
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">범위</div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${sensitiveFields.length}, 1fr)` }}>
            {sensitiveFields.map((f) => (
              <div key={f} className="text-[11px] font-bold text-muted-foreground text-center uppercase tracking-wide">{f}</div>
            ))}
          </div>
        </div>

        {/* 데이터 행 */}
        {rules.map((r) => {
          const isAdmin = r.role === 'hr-admin';
          return (
            <div
              key={r.role}
              className={`grid items-center px-4 py-4 border-b border-border last:border-b-0 ${isAdmin ? 'bg-primary/5' : ''}`}
              style={{ gridTemplateColumns: '220px 80px 1fr' }}
            >
              <div>
                <div className={`text-[13px] ${isAdmin ? 'font-bold' : 'font-medium'} text-foreground`}>{r.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{r.note}</div>
              </div>
              <div>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-pill ${SCOPE_BG_CLS[r.scope]}`}>
                  {r.scope}
                </span>
              </div>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${sensitiveFields.length}, 1fr)` }}>
                {sensitiveFields.map((field) => {
                  const allowed = !!r.sensitive[field];
                  return (
                    <div key={field} className="flex justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => !isAdmin && toggle(r.role, field)}
                        className={`h-auto p-1 ${isAdmin ? 'cursor-default pointer-events-none' : ''}`}
                        aria-label={`${r.title} ${field} ${allowed ? '허용' : '차단'}`}
                      >
                        {isAdmin
                          ? <Eye size={16} className="text-primary" aria-hidden />
                          : allowed
                            ? <Eye size={16} className="text-info-500" aria-hidden />
                            : <EyeOff size={16} className="text-muted-foreground" aria-hidden />}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Card>

      {/* 차단 구조 */}
      <Card title="본부 간·팀 간 격리 구조">
        <div className="grid grid-cols-2 gap-3">
          {[
            { title: '본부 간 격리',              items: ['전략기획본부', '기술본부', 'HR본부', '영업본부'], textCls: 'text-primary', borderCls: 'border-primary' },
            { title: '팀 간 격리 (예: 기술본부)', items: ['개발팀', '인프라팀', 'QA팀'],                    textCls: 'text-info-700',  borderCls: 'border-info-500' },
          ].map((group, gi) => (
            <div key={gi} className="border border-border rounded-lg p-4 bg-muted">
              <div className={`flex items-center gap-2 mb-3`}>
                <Lock size={13} className={group.textCls} />
                <span className={`text-[12px] font-bold ${group.textCls}`}>{group.title}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item, ii) => (
                  <div key={ii} className="border border-border rounded-md px-3 py-1.5 text-[12px] text-foreground font-medium bg-card">
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-3">
                <EyeOff size={11} className="text-danger-500" />
                <span className="text-[11px] text-danger-600">각 단위는 상호 열람 불가</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ── 목록 뷰 ── */
function ListView({ chart }: { chart: OrgChartNode | null }) {
  const rows = useMemo(() => {
    const groups = chart?.children ?? [];
    return groups.flatMap((g) => {
      const divisions = g.children ?? [];
      if (divisions.length === 0) {
        return [{ id: g.id, dept: g.name, type: g.type, members: g.totalCount, indent: 0 }];
      }
      return [
        { id: g.id, dept: g.name, type: g.type, members: g.totalCount, indent: 0 },
        ...divisions.map((d) => ({
          id: d.id,
          dept: `└ ${d.name}`,
          type: d.type,
          members: d.totalCount,
          indent: 1,
        })),
      ];
    });
  }, [chart]);

  if (rows.length === 0) {
    return <EmptyState title="조직이 아직 없어요." />;
  }

  return (
    <Card padding="sm">
      {/* 헤더 */}
      <div className="grid px-4 py-2 bg-muted border-b border-border" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
        {['조직', '유형', '인원'].map((h) => (
          <div key={h} className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{h}</div>
        ))}
      </div>

      {rows.map((d, ri) => {
        const levelTextCls = d.indent === 0 ? 'text-primary' : 'text-purple-600';
        const levelBgCls   = d.indent === 0 ? 'bg-primary' : 'bg-purple-600';
        return (
          <div
            key={d.id}
            className={`grid items-center px-4 py-3 border-b border-border last:border-b-0 ${d.indent === 0 ? 'bg-primary/[0.02]' : 'bg-card'}`}
            style={{ gridTemplateColumns: '2fr 1fr 1fr' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`flex shrink-0 items-center justify-center rounded-full w-[30px] h-[30px] ${levelBgCls}`}
              >
                <Users size={14} className="text-white" />
              </div>
              <span
                className={`text-[13px] text-foreground ${d.indent === 0 ? 'font-bold' : 'font-medium'}`}
                style={{ paddingLeft: d.indent * 8 }}
              >
                {d.dept}
              </span>
            </div>
            <div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-pill ${levelBgCls}/15 ${levelTextCls}`}>
                {TYPE_LABEL[d.type]}
              </span>
            </div>
            <div className="tabular-nums text-[13px] font-semibold text-foreground">
              {d.members}명
            </div>
          </div>
        );
      })}
    </Card>
  );
}

/* ── 메인 View ── */
export function OrgView() {
  const { user } = useAuth();
  const toast = useToast();
  const editable = !!user && isHrAdmin(user.role);

  const { data: chart, loading: chartLoading, error: chartError, reload: reloadChart } = useOrgChartData(!!user);
  const { data: usersData, reload: reloadUsers } = useUsers({ includeInactive: true, pageSize: 500 }, { enabled: !!user });
  const { data: positionsData } = usePositions({}, { enabled: !!user });

  const [view, setView] = useState<'chart' | 'list' | 'visibility'>('chart');

  const [nodeModalOpen,  setNodeModalOpen]  = useState(false);
  const [nodeModalMode,  setNodeModalMode]  = useState<OrgNodeModalMode>('create');
  const [nodeParent,     setNodeParent]     = useState<OrgChartNode | null>(null);
  const [nodeTarget,     setNodeTarget]     = useState<OrgChartNode | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<OrgChartNode | null>(null);
  const [nodeDeleting,   setNodeDeleting]   = useState(false);
  const [personOpen,     setPersonOpen]     = useState(false);
  const [personMode,     setPersonMode]     = useState<'create' | 'edit'>('create');
  const [personDraft,    setPersonDraft]    = useState<PersonEditDraft | null>(null);
  const [personErrors,   setPersonErrors]   = useState<Partial<Record<keyof PersonEditDraft, string>>>({});
  const [personSaving,   setPersonSaving]   = useState(false);

  const flat = useMemo(() => flattenOrg(chart), [chart]);

  const orgOptions = useMemo(() => {
    const groups: { id: string; name: string }[] = [];
    const divisions: { id: string; name: string; groupId: string }[] = [];
    const teams: { id: string; name: string; parentId: string }[] = [];
    flat.forEach((n) => {
      if (n.type === 'group') groups.push({ id: n.id, name: n.name });
      else if (n.type === 'division') divisions.push({ id: n.id, name: n.name, groupId: n.parentId ?? '' });
      else if (n.type === 'team') teams.push({ id: n.id, name: n.name, parentId: n.parentId ?? '' });
    });
    return { groups, divisions, teams };
  }, [flat]);

  function openCreate() {
    const firstGroup = orgOptions.groups[0]?.id ?? '';
    const position: Position = 'pro';
    setPersonMode('create');
    setPersonErrors({});
    setPersonDraft({
      name: '', email: '', groupId: firstGroup, divisionId: null, teamId: null,
      position, role: defaultRoleForPosition(position),
      visibilityScope: defaultScopeForPosition(position),
      roleOverride: false, scopeOverride: false,
    });
    setPersonOpen(true);
  }

  async function savePerson() {
    if (!personDraft) return;
    const errs: Partial<Record<keyof PersonEditDraft, string>> = {};
    if (!personDraft.name.trim()) errs.name = '이름을 입력해 주세요.';
    if (personMode === 'create' && !personDraft.email.trim()) errs.email = '이메일을 입력해 주세요.';
    if (!personDraft.groupId) errs.groupId = '소속 그룹을 선택해 주세요.';
    if (Object.keys(errs).length > 0) { setPersonErrors(errs); return; }
    const departmentId = personDraft.teamId ?? personDraft.divisionId ?? personDraft.groupId;
    setPersonSaving(true);
    try {
      if (personMode === 'create') {
        const body: CreateUserRequest = {
          email: personDraft.email.trim(), name: personDraft.name.trim(),
          position: personDraft.position, departmentId,
          role: personDraft.roleOverride ? personDraft.role : undefined,
          visibilityScope: personDraft.scopeOverride ? personDraft.visibilityScope : undefined,
        };
        await userCommands.create(body);
        toast.show({ variant: 'success', message: '구성원을 추가했어요.' });
      } else if (personDraft.id) {
        const body: UpdateUserRequest = {
          name: personDraft.name.trim(), position: personDraft.position,
          departmentId, role: personDraft.role, visibilityScope: personDraft.visibilityScope,
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
        toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '저장에 실패했어요.' });
      }
    } finally {
      setPersonSaving(false);
    }
  }

  function openAddRoot() {
    setNodeModalMode('create');
    setNodeParent(null);
    setNodeTarget(null);
    setNodeModalOpen(true);
  }

  function handleNodeAction(action: 'rename' | 'addChild' | 'delete', node: OrgChartNode) {
    if (action === 'rename') {
      setNodeModalMode('rename');
      setNodeTarget(node);
      setNodeParent(null);
      setNodeModalOpen(true);
    } else if (action === 'addChild') {
      if (node.type === 'team') { toast.show({ variant: 'info', message: '팀 아래에는 더 추가할 수 없어요.' }); return; }
      setNodeModalMode('create');
      setNodeParent(node);
      setNodeTarget(null);
      setNodeModalOpen(true);
    } else if (action === 'delete') {
      setDeleteTarget(node);
    }
  }

  async function submitNode(data: { name: string; type: OrgNodeType; parentId?: string }) {
    try {
      if (nodeModalMode === 'create') {
        await departmentCommands.create({ name: data.name, type: data.type, parentId: data.parentId });
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
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '저장에 실패했어요.' });
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
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '삭제에 실패했어요.' });
    } finally {
      setNodeDeleting(false);
    }
  }

  if (!user) return null;
  if (chartError) return <ErrorState onRetry={reloadChart} message="조직도를 불러오지 못했어요." />;

  return (
    <PageContainer>
      <PageHeader
        title="조직도"
        subtitle={chart
          ? `${chart.name} 임직원 ${chart.totalCount}명 · 평가 대상자 구성`
          : '에너지엑스 조직 현황 및 평가 대상자 구성'}
        right={
          <div className="flex items-center gap-2.5">
            {editable && view === 'chart' && (
              <Button variant="primary" size="sm" onClick={openCreate}>
                구성원 추가 +
              </Button>
            )}
            <SegmentedControl
              options={[
                { value: 'chart', label: '조직도' },
                { value: 'list', label: '목록' },
                { value: 'visibility', label: '가시성 설정' },
              ]}
              value={view}
              onChange={(v) => setView(v as typeof view)}
              size="sm"
              ariaLabel="조직도 보기 전환"
            />
          </div>
        }
      />

      {view === 'chart' && (
        <Card>
          {chartLoading && !chart ? (
            <Skeleton className="h-48 w-full" />
          ) : !chart ? (
            <EmptyState
              title="조직이 아직 없어요."
              action={editable ? <Button size="sm" onClick={openAddRoot}>그룹 추가</Button> : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <div className="flex justify-center" style={{ minWidth: 'max-content', padding: '16px 0' }}>
                <OrgNodeCard
                  node={chart}
                  level={0}
                  editable={editable}
                  onAction={handleNodeAction}
                />
              </div>
            </div>
          )}
        </Card>
      )}

      {view === 'list' && <ListView chart={chart} />}

      {view === 'visibility' && <VisibilityView />}

      {/* 조직 노드 추가/이름변경 */}
      <OrgNodeModal
        open={nodeModalOpen}
        mode={nodeModalMode}
        parentNode={nodeParent}
        targetNode={nodeTarget}
        onClose={() => { setNodeModalOpen(false); setNodeParent(null); setNodeTarget(null); }}
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
          positions={positionsData?.data ?? []}
          errors={personErrors}
          saving={personSaving}
          onChange={(patch) => setPersonDraft((d) => (d ? { ...d, ...patch } : d))}
          onSubmit={() => void savePerson()}
          onClose={() => { setPersonOpen(false); setPersonDraft(null); }}
        />
      )}
    </PageContainer>
  );
}
