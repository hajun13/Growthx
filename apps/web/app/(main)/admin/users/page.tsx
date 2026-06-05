'use client';

// 사용자 관리 (hr_admin) — 디자인 UserMgmt.tsx 레이아웃을 실 API에 연동.
// 목록: GET /users(useUsers) + GET /org-chart(부서 경로·드롭다운). CRUD: userCommands.
// 디자인의 group/dept/team 은 User.departmentId → 조직 트리 deptPath 로 합성한다.
// 디자인의 title(직급) 은 User.position(한글 라벨).
import { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  ChevronDown,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUsers, userCommands } from '@/hooks/useUsers';
import { useOrgChart } from '@/hooks/useOrgChart';
import { departmentCommands } from '@/hooks/useDepartments';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Forbidden, ErrorState } from '@/components/States';
import { Modal } from '@/components/Modal';
import {
  OrgNodeModal,
  type OrgNodeModalMode,
} from '@/components/OrgNodeModal';
import { isHrAdmin } from '@/lib/nav';
import { flattenOrg, deptPath } from '@/lib/org';
import { positionLabel } from '@/lib/ui';
import type {
  User,
  Position,
  OrgChartNode,
  OrgNodeType,
  CreateUserRequest,
  UpdateUserRequest,
} from '@/lib/types';

/* ── Toss 색상(디자인 inline 그대로) ── */
const T = {
  grey50: '#f9fafb',
  grey100: '#f2f4f6',
  grey200: '#e5e8eb',
  grey400: '#b0b8c1',
  grey500: '#8b95a1',
  grey600: '#6b7684',
  grey700: '#4e5968',
  grey800: '#333d4b',
  grey900: '#191f28',
  blue500: '#3182f6',
  red500: '#d22030',
  purple: '#A21CAF',
};
const FONT = 'Pretendard, sans-serif';

// 직급(Position) 선택 옵션 — 디자인의 TITLES 자리.
const POSITION_OPTIONS: Position[] = [
  'ceo',
  'vice_president',
  'executive',
  'director',
  'principal',
  'division_head',
  'team_lead',
  'chief',
  'senior',
  'pro',
];

// 직급 칩 색상(상위→하위로 점층).
const positionColor: Record<Position, string> = {
  ceo: T.purple,
  vice_president: T.purple,
  executive: T.blue500,
  director: T.blue500,
  principal: T.grey800,
  division_head: T.grey800,
  team_lead: T.grey700,
  chief: T.grey600,
  senior: T.grey500,
  pro: T.grey400,
};

// 화면 행 모델 — User + 합성한 그룹/본부/팀.
interface Row {
  user: User;
  group: string;
  division: string;
  team: string;
  positionLabel: string;
}

interface OrgOptions {
  groups: { id: string; name: string }[];
  divisions: { id: string; name: string; groupId: string }[];
  teams: { id: string; name: string; divisionId: string }[];
}

// 폼 상태 — 디자인 FormState 에 대응(조직은 id 로 선택).
interface FormState {
  name: string;
  email: string;
  groupId: string;
  divisionId: string;
  teamId: string;
  position: Position | '';
}

const emptyForm = (): FormState => ({
  name: '',
  email: '',
  groupId: '',
  divisionId: '',
  teamId: '',
  position: '',
});

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: `1px solid ${T.grey200}`,
  fontSize: 13,
  outline: 'none',
  background: '#fff',
};

function UserForm({
  initial,
  org,
  onSave,
  onCancel,
  title,
  saving,
}: {
  initial: FormState;
  org: OrgOptions;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  title: string;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);

  const set = (patch: Partial<FormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      // 상위 변경 시 하위 초기화(디자인 동작).
      if (patch.groupId !== undefined) {
        next.divisionId = '';
        next.teamId = '';
      }
      if (patch.divisionId !== undefined) {
        next.teamId = '';
      }
      return next;
    });
  };

  const divisionList = form.groupId
    ? org.divisions.filter((d) => d.groupId === form.groupId)
    : [];
  const teamList = form.divisionId
    ? org.teams.filter((t) => t.divisionId === form.divisionId)
    : [];

  // 그룹·직급·이름·이메일 필수. 본부/팀은 조직 구조에 따라 선택(그룹만 있을 수도).
  const valid = !!(form.name && form.email && form.groupId && form.position);

  const selectStyle = (filled: boolean, enabled: boolean): React.CSSProperties => ({
    ...inputBase,
    color: filled ? T.grey900 : T.grey500,
    background: enabled ? '#fff' : T.grey50,
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          width: 480,
          maxHeight: '90vh',
          overflow: 'auto',
          background: '#fff',
          border: `1px solid ${T.grey200}`,
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${T.grey200}`,
            background: T.grey50,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: T.grey900 }}>
            {title}
          </span>
          <button onClick={onCancel} aria-label="닫기">
            <X size={16} color={T.grey600} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 이름 */}
          <Field label="이름" required>
            <input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="홍길동"
              style={inputBase}
            />
          </Field>
          {/* 이메일 */}
          <Field label="이메일" required>
            <input
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="hong@energyx.co.kr"
              type="email"
              style={inputBase}
            />
          </Field>
          {/* 그룹 */}
          <Field label="그룹" required>
            <select
              value={form.groupId}
              onChange={(e) => set({ groupId: e.target.value })}
              style={selectStyle(!!form.groupId, true)}
            >
              <option value="">그룹 선택</option>
              {org.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          {/* 본부 */}
          <Field label="본부">
            <select
              value={form.divisionId}
              onChange={(e) => set({ divisionId: e.target.value })}
              disabled={!form.groupId}
              style={selectStyle(!!form.divisionId, !!form.groupId)}
            >
              <option value="">본부 선택</option>
              {divisionList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          {/* 팀 */}
          <Field label="팀">
            <select
              value={form.teamId}
              onChange={(e) => set({ teamId: e.target.value })}
              disabled={!form.divisionId}
              style={selectStyle(!!form.teamId, !!form.divisionId)}
            >
              <option value="">팀 선택</option>
              {teamList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          {/* 직급 */}
          <Field label="직급" required>
            <select
              value={form.position}
              onChange={(e) => set({ position: e.target.value as Position })}
              style={selectStyle(!!form.position, true)}
            >
              <option value="">직급 선택</option>
              {POSITION_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {positionLabel[p]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div
          className="flex items-center justify-end gap-3"
          style={{ padding: '16px 24px', borderTop: `1px solid ${T.grey200}` }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: `1px solid ${T.grey200}`,
              fontSize: 13,
              color: T.grey700,
              background: '#fff',
            }}
          >
            취소
          </button>
          <button
            onClick={() => valid && !saving && onSave(form)}
            disabled={!valid || saving}
            className="flex items-center gap-1.5"
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: valid && !saving ? T.blue500 : T.grey400,
              cursor: valid && !saving ? 'pointer' : 'default',
            }}
          >
            <Save size={14} /> {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: T.grey800,
          display: 'block',
          marginBottom: 5,
        }}
      >
        {label}{' '}
        {required && <span style={{ color: T.red500 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const ORG_TYPE_LABEL: Record<OrgNodeType, string> = {
  group: '그룹',
  division: '본부',
  team: '팀',
};

// 조직 구조 트리 행(들여쓰기 + 인라인 CRUD). 회사 루트는 OrgStructureView 에서 제외.
function OrgTreeRow({
  node,
  depth,
  editable,
  onAction,
}: {
  node: OrgChartNode;
  depth: number;
  editable: boolean;
  onAction: (action: 'addChild' | 'rename' | 'delete', node: OrgChartNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  // depth 0=그룹, 1=본부, 2=팀.
  const dotColor = depth === 0 ? T.blue500 : depth === 1 ? T.grey800 : T.grey600;

  return (
    <>
      <div
        className="flex items-center"
        style={{
          padding: '10px 20px',
          paddingLeft: 20 + depth * 24,
          borderBottom: `1px solid ${T.grey200}`,
          gap: 10,
        }}
      >
        {/* 펼치기/접기 */}
        <button
          onClick={() => hasChildren && setExpanded((v) => !v)}
          style={{ width: 16, display: 'flex', justifyContent: 'center', color: T.grey500 }}
          aria-label={expanded ? '접기' : '펼치기'}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <span style={{ width: 14, display: 'inline-block' }} />
          )}
        </button>
        {/* 타입 점 */}
        <span
          className="is-circle flex-shrink-0"
          style={{ width: 8, height: 8, background: dotColor, display: 'inline-block' }}
        />
        {/* 이름 + 유형 */}
        <span style={{ fontSize: 13, fontWeight: depth === 0 ? 700 : 500, color: T.grey900 }}>
          {node.name}
        </span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: T.grey600,
            background: T.grey100,
            padding: '1px 7px',
          }}
        >
          {ORG_TYPE_LABEL[node.type]}
        </span>
        <span style={{ fontSize: 11, color: T.grey500 }}>{node.totalCount}명</span>

        {/* 인라인 액션 */}
        {editable && (
          <div className="flex items-center gap-2.5" style={{ marginLeft: 'auto' }}>
            {node.type !== 'team' && (
              <button
                onClick={() => onAction('addChild', node)}
                style={{ fontSize: 11, fontWeight: 600, color: T.blue500 }}
              >
                + {node.type === 'group' ? '본부' : '팀'}
              </button>
            )}
            <button
              onClick={() => onAction('rename', node)}
              style={{ fontSize: 11, color: T.grey600 }}
            >
              이름 수정
            </button>
            <button
              onClick={() => onAction('delete', node)}
              style={{ fontSize: 11, color: T.red500 }}
            >
              삭제
            </button>
          </div>
        )}
      </div>
      {hasChildren &&
        expanded &&
        children.map((c) => (
          <OrgTreeRow
            key={c.id}
            node={c}
            depth={depth + 1}
            editable={editable}
            onAction={onAction}
          />
        ))}
    </>
  );
}

export default function UserMgmtPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = !!user && isHrAdmin(user.role);

  const {
    data: usersData,
    loading: usersLoading,
    error: usersError,
    reload: reloadUsers,
  } = useUsers({ includeInactive: true, pageSize: 500 }, { enabled: !!user });

  const {
    data: chart,
    loading: chartLoading,
    reload: reloadChart,
  } = useOrgChart({ enabled: !!user });

  const flat = useMemo(() => flattenOrg(chart), [chart]);

  // 조직 드롭다운 옵션(그룹/본부/팀 — id·이름·상위 id).
  const org = useMemo<OrgOptions>(() => {
    const groups: OrgOptions['groups'] = [];
    const divisions: OrgOptions['divisions'] = [];
    const teams: OrgOptions['teams'] = [];
    flat.forEach((n) => {
      if (n.type === 'group') groups.push({ id: n.id, name: n.name });
      else if (n.type === 'division')
        divisions.push({ id: n.id, name: n.name, groupId: n.parentId ?? '' });
      else if (n.type === 'team')
        teams.push({ id: n.id, name: n.name, divisionId: n.parentId ?? '' });
    });
    return { groups, divisions, teams };
  }, [flat]);

  // User → 행(그룹/본부/팀 합성).
  const rows = useMemo<Row[]>(() => {
    const list = usersData?.data ?? [];
    return list.map((u) => {
      const path = deptPath(u.departmentId, flat); // [group, division, team] (짧을 수 있음)
      return {
        user: u,
        group: path[0] ?? '',
        division: path[1] ?? '',
        team: path[2] ?? '',
        positionLabel: positionLabel[u.position] ?? u.position,
      };
    });
  }, [usersData, flat]);

  const [tab, setTab] = useState<'users' | 'org'>('users');

  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('전체');

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  // ── 조직 노드 CRUD 상태 ──
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [nodeModalMode, setNodeModalMode] = useState<OrgNodeModalMode>('create');
  const [nodeParent, setNodeParent] = useState<OrgChartNode | null>(null);
  const [nodeTarget, setNodeTarget] = useState<OrgChartNode | null>(null);
  const [nodeDeleteTarget, setNodeDeleteTarget] = useState<OrgChartNode | null>(null);
  const [nodeDeleting, setNodeDeleting] = useState(false);

  const groupFilterOptions = useMemo(
    () => ['전체', ...org.groups.map((g) => g.name)],
    [org.groups],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (filterGroup !== '전체' && r.group !== filterGroup) return false;
        if (search) {
          const q = search.toLowerCase();
          const hay = `${r.user.name} ${r.user.email} ${r.team} ${r.division}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [rows, filterGroup, search],
  );

  // 통계(전체/이사 이상/본부장·팀장/팀원).
  const stats = useMemo(() => {
    const total = rows.length;
    const exec = rows.filter((r) =>
      ['ceo', 'vice_president', 'executive', 'director'].includes(r.user.position),
    ).length;
    const lead = rows.filter((r) =>
      ['division_head', 'team_lead'].includes(r.user.position),
    ).length;
    const member = rows.filter((r) =>
      ['principal', 'chief', 'senior', 'pro'].includes(r.user.position),
    ).length;
    return { total, exec, lead, member };
  }, [rows]);

  // ── CRUD ──
  function resolveDeptId(f: FormState): string {
    return f.teamId || f.divisionId || f.groupId;
  }

  async function handleAdd(f: FormState) {
    setSaving(true);
    try {
      const body: CreateUserRequest = {
        email: f.email.trim(),
        name: f.name.trim(),
        position: f.position as Position,
        departmentId: resolveDeptId(f),
      };
      await userCommands.create(body);
      toast.show({ variant: 'success', message: '사용자를 추가했어요.' });
      setShowForm(false);
      reloadUsers();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message:
          err instanceof ApiError && err.code === 'ALREADY_EXISTS'
            ? '이미 등록된 이메일이에요.'
            : err instanceof ApiError
              ? err.message
              : '추가에 실패했어요.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(f: FormState) {
    if (!editTarget) return;
    setSaving(true);
    try {
      const body: UpdateUserRequest = {
        name: f.name.trim(),
        position: f.position as Position,
        departmentId: resolveDeptId(f),
      };
      await userCommands.update(editTarget.user.id, body);
      toast.show({ variant: 'success', message: '사용자를 수정했어요.' });
      setEditTarget(null);
      reloadUsers();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '수정에 실패했어요.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await userCommands.deactivate(deleteTarget.user.id);
      toast.show({ variant: 'success', message: '사용자를 비활성화했어요.' });
      setDeleteTarget(null);
      reloadUsers();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '삭제에 실패했어요.',
      });
    } finally {
      setSaving(false);
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
    action: 'addChild' | 'rename' | 'delete',
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
    } else {
      setNodeDeleteTarget(node);
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
    if (!nodeDeleteTarget) return;
    setNodeDeleting(true);
    try {
      await departmentCommands.remove(nodeDeleteTarget.id);
      toast.show({ variant: 'success', message: '조직을 삭제했어요.' });
      setNodeDeleteTarget(null);
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

  // Row → 폼 초기값(id 기반 조직 선택).
  function rowToForm(r: Row): FormState {
    const u = r.user;
    // departmentId 가 어느 레벨인지 판정해 그룹/본부/팀 id 채움.
    const node = flat.get(u.departmentId);
    let groupId = '';
    let divisionId = '';
    let teamId = '';
    if (node) {
      if (node.type === 'team') {
        teamId = node.id;
        divisionId = node.parentId ?? '';
        const div = divisionId ? flat.get(divisionId) : undefined;
        groupId = div?.parentId ?? '';
      } else if (node.type === 'division') {
        divisionId = node.id;
        groupId = node.parentId ?? '';
      } else if (node.type === 'group') {
        groupId = node.id;
      }
    }
    return {
      name: u.name,
      email: u.email,
      groupId,
      divisionId,
      teamId,
      position: u.position,
    };
  }

  if (!user) return null;
  if (!isAdmin) {
    return <Forbidden message="사용자 관리는 HR 관리자만 접근할 수 있어요." />;
  }
  if (usersError) {
    return <ErrorState onRetry={reloadUsers} message="사용자를 불러오지 못했어요." />;
  }

  const statCards = [
    { label: '전체 사용자', value: stats.total, bg: T.grey900 },
    { label: '이사 이상', value: stats.exec, bg: T.blue500 },
    { label: '본부장·팀장', value: stats.lead, bg: T.grey800 },
    { label: '팀원', value: stats.member, bg: T.grey700 },
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, fontFamily: FONT }}>
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.grey900 }}>사용자 관리</h1>
          <p style={{ fontSize: 13, color: T.grey600, marginTop: 2 }}>
            {tab === 'users'
              ? '시스템 사용자를 추가·수정·비활성화합니다.'
              : '그룹·본부·팀 조직 구조를 추가·수정·삭제합니다.'}
          </p>
        </div>
        {tab === 'users' ? (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5"
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: T.blue500,
            }}
          >
            <Plus size={14} /> 사용자 추가
          </button>
        ) : (
          <button
            onClick={openAddRoot}
            className="flex items-center gap-1.5"
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: T.blue500,
            }}
          >
            <Plus size={14} /> 그룹 추가
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex" style={{ borderBottom: `1px solid ${T.grey200}` }}>
        {([
          { key: 'users', label: '사용자 목록' },
          { key: 'org', label: '조직 구조' },
        ] as const).map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? T.grey900 : T.grey500,
                borderBottom: `2px solid ${active ? T.grey900 : 'transparent'}`,
                marginBottom: -1,
                background: 'transparent',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'org' && (
        <div style={{ background: '#fff', border: `1px solid ${T.grey200}`, overflow: 'hidden' }}>
          <div
            className="flex items-center gap-2"
            style={{ padding: '12px 20px', borderBottom: `1px solid ${T.grey200}`, background: T.grey50 }}
          >
            <Building2 size={14} color={T.grey600} />
            <span style={{ fontSize: 12, fontWeight: 600, color: T.grey700 }}>
              조직 구조 (그룹 → 본부 → 팀)
            </span>
          </div>
          {chartLoading && !chart ? (
            <div style={{ padding: 48, textAlign: 'center', color: T.grey500, fontSize: 13 }}>
              불러오는 중…
            </div>
          ) : !chart || (chart.children ?? []).length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: T.grey500, fontSize: 13 }}>
              조직이 아직 없어요. 오른쪽 위 “그룹 추가”로 시작하세요.
            </div>
          ) : (
            (chart.children ?? []).map((g) => (
              <OrgTreeRow
                key={g.id}
                node={g}
                depth={0}
                editable={isAdmin}
                onAction={handleNodeAction}
              />
            ))
          )}
        </div>
      )}

      {tab === 'users' && (
      <>
      {/* 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {statCards.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3"
            style={{ background: '#fff', border: `1px solid ${T.grey200}`, padding: '16px 20px' }}
          >
            <div
              className="flex items-center justify-center"
              style={{ width: 40, height: 40, background: s.bg }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{s.value}</span>
            </div>
            <span style={{ fontSize: 12.5, color: T.grey700 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="flex items-center gap-2"
          style={{ border: `1px solid ${T.grey200}`, padding: '8px 12px', background: '#fff', minWidth: 220 }}
        >
          <Search size={13} color={T.grey500} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름·이메일·팀 검색"
            className="outline-none flex-1"
            style={{ fontSize: 12.5, background: 'transparent', color: T.grey900, border: 'none' }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {groupFilterOptions.map((g) => {
            const active = filterGroup === g;
            return (
              <button
                key={g}
                onClick={() => setFilterGroup(g)}
                style={{
                  padding: '6px 12px',
                  fontSize: 11.5,
                  fontWeight: 500,
                  background: active ? T.grey900 : '#fff',
                  color: active ? '#fff' : T.grey700,
                  border: `1px solid ${active ? T.grey900 : T.grey200}`,
                }}
              >
                {g}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 12, color: T.grey500, marginLeft: 'auto' }}>
          {filtered.length}명
        </span>
      </div>

      {/* 테이블 */}
      <div style={{ background: '#fff', border: `1px solid ${T.grey200}`, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 90px 1fr 56px',
            padding: '12px 20px',
            borderBottom: `1px solid ${T.grey200}`,
            background: T.grey50,
          }}
        >
          {['이름', '그룹 / 본부', '팀', '직급', '이메일', ''].map((h, i) => (
            <div key={i} style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>
              {h}
            </div>
          ))}
        </div>

        {usersLoading && rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.grey500, fontSize: 13 }}>
            불러오는 중…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.grey500, fontSize: 13 }}>
            검색 결과가 없습니다.
          </div>
        ) : (
          filtered.map((r) => {
            const u = r.user;
            return (
              <div
                key={u.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 90px 1fr 56px',
                  alignItems: 'center',
                  padding: '14px 20px',
                  borderBottom: `1px solid ${T.grey200}`,
                  opacity: u.isActive ? 1 : 0.5,
                }}
              >
                {/* 이름 */}
                <div className="flex items-center gap-2.5">
                  <div
                    className="is-circle flex items-center justify-center text-white flex-shrink-0"
                    style={{ width: 32, height: 32, background: T.blue500, fontSize: 12, fontWeight: 700 }}
                  >
                    {u.name[0]}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>
                    {u.name}
                    {!u.isActive && (
                      <span style={{ fontSize: 10, color: T.grey500, marginLeft: 6 }}>(비활성)</span>
                    )}
                  </div>
                </div>
                {/* 그룹/본부 */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: T.grey900 }}>
                    {r.group || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: T.grey500, marginTop: 1 }}>
                    {r.division || '—'}
                  </div>
                </div>
                {/* 팀 */}
                <div style={{ fontSize: 12.5, color: T.grey700 }}>{r.team || '—'}</div>
                {/* 직급 */}
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: positionColor[u.position] ?? T.grey700,
                      background: T.grey100,
                      padding: '2px 8px',
                    }}
                  >
                    {r.positionLabel}
                  </span>
                </div>
                {/* 이메일 */}
                <div style={{ fontSize: 12, color: T.grey600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.email}
                </div>
                {/* 액션 */}
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditTarget(r)} title="수정" style={{ color: T.blue500 }}>
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => setDeleteTarget(r)} title="비활성화" style={{ color: T.red500 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      </>
      )}

      {/* 추가 폼 */}
      {showForm && (
        <UserForm
          title="사용자 추가"
          initial={emptyForm()}
          org={org}
          saving={saving}
          onSave={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* 수정 폼 */}
      {editTarget && (
        <UserForm
          title="사용자 수정"
          initial={rowToForm(editTarget)}
          org={org}
          saving={saving}
          onSave={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* 삭제(비활성화) 확인 */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT,
          }}
        >
          <div style={{ width: 380, background: '#fff', border: `1px solid ${T.grey200}` }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.grey200}`, background: T.grey50 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.grey900 }}>사용자 비활성화</span>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: 13, color: T.grey700, lineHeight: 1.7 }}>
                <strong>{deleteTarget.user.name}</strong> (
                {deleteTarget.team || deleteTarget.division || deleteTarget.group || '소속 미지정'} ·{' '}
                {deleteTarget.positionLabel})을(를) 비활성화합니다.
                <br />
                비활성화된 사용자는 로그인할 수 없어요.
              </p>
            </div>
            <div
              className="flex justify-end gap-3"
              style={{ padding: '16px 24px', borderTop: `1px solid ${T.grey200}` }}
            >
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ padding: '8px 16px', border: `1px solid ${T.grey200}`, fontSize: 13, color: T.grey700, background: '#fff' }}
              >
                취소
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={saving}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: T.red500 }}
              >
                {saving ? '처리 중…' : '비활성화'}
              </button>
            </div>
          </div>
        </div>
      )}

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
        open={nodeDeleteTarget !== null}
        onClose={() => setNodeDeleteTarget(null)}
        title="조직을 삭제할까요?"
        primaryAction={{
          label: '삭제',
          variant: 'danger',
          loading: nodeDeleting,
          onClick: () => void confirmDeleteNode(),
        }}
        secondaryAction={{ label: '취소', onClick: () => setNodeDeleteTarget(null) }}
      >
        {nodeDeleteTarget?.name} 을(를) 삭제하면 되돌릴 수 없어요. 구성원이나 하위
        조직이 있으면 삭제할 수 없으니, 먼저 옮기거나 비워 주세요.
      </Modal>
    </div>
  );
}
