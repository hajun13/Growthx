'use client';

/**
 * AdminUsersView — 사용자 관리 페이지 (hr_admin).
 * 오케스트레이터: 상태·핸들러 집중, UI는 UsersTab / PositionsTab / OrgStructureBoard 위임.
 * DS: PageContainer, PageHeader, Tabs, Button, Modal.
 * 인라인 style/hex 제거. 파일상한 ~200줄 준수.
 */

import { useMemo, useRef, useState } from 'react';
import {
  Plus,
} from 'lucide-react';
// DnD 이동 토스트의 "되돌리기" 액션 — 공용 Toast 어댑터는 action 미지원이라 sonner 직접 사용.
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUsers } from '../hooks';
import { userCommands, ApiError as UserApiError } from '../api';
import { useOrgChart } from '@/hooks/useOrgChart';
import { departmentCommands } from '@/hooks/useDepartments';
import { usePositions, positionCommands } from '@/hooks/usePositions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { evaluationCommands } from '@/hooks/useEvaluations';
import { OrgStructureBoard } from '@/components/OrgStructureBoard';
import { ApiError } from '@/lib/api';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrgNodeModal, type OrgNodeModalMode } from '@/components/OrgNodeModal';
import { PersonEditModal, type PersonEditDraft } from '@/components/PersonEditModal';
import { isHrAdmin } from '@/lib/nav';
import { flattenOrg, deptByType, defaultRoleForPosition, defaultScopeForPosition } from '@/lib/org';
import { getPositionLabel } from '@/lib/ui';
import type {
  User, Position, PositionDef, OrgChartNode, OrgNodeType,
  CreateUserRequest, UpdateUserRequest,
  CreatePositionRequest, UpdatePositionRequest,
} from '@/lib/types';

import { UserFormModal, EMAIL_RE, type FormState } from './UserFormModal';
import { UserLifecycleDialogs } from './UserLifecycleDialogs';
import { ConfirmDialog } from './dialogs';
import { Forbidden, ErrorState } from './StateViews';
import { OrgTabPanels } from './OrgTabPanels';
import { UsersTab, type UserSortKey, type SortDir } from './UsersTab';
import { PositionsTab } from './PositionsTab';

interface Row { user: User; group: string; division: string; team: string; positionLabel: string; }
interface OrgOptions { groups: { id: string; name: string }[]; divisions: { id: string; name: string; groupId: string }[]; teams: { id: string; name: string; divisionId: string }[]; }

function emptyForm(): FormState {
  return { name: '', email: '', groupId: '', divisionId: '', teamId: '', position: '', hireDate: '', birthDate: '' };
}

export function AdminUsersView() {
  const { user } = useAuth();
  const isAdmin = !!user && isHrAdmin(user.role);
  const [includeInactive, setIncludeInactive] = useState(true);

  const { data: usersData, loading: usersLoading, error: usersError, reload: reloadUsers } = useUsers({ includeInactive, pageSize: 500 }, { enabled: !!user });
  const { data: chart, loading: chartLoading, reload: reloadChart } = useOrgChart({ enabled: !!user });
  const { current: currentCycle } = useCurrentCycle();
  const cycleId = currentCycle?.id;
  const { data: positionsData, loading: positionsLoading, reload: reloadPositions } = usePositions({ includeInactive: true }, { enabled: !!user });

  const positions = useMemo(() => positionsData?.data ?? [], [positionsData]);
  const activePositions = useMemo(() => positions.filter((p) => p.isActive), [positions]);
  const flat = useMemo(() => flattenOrg(chart), [chart]);

  const org = useMemo<OrgOptions>(() => {
    const groups: OrgOptions['groups'] = [];
    const divisions: OrgOptions['divisions'] = [];
    const teams: OrgOptions['teams'] = [];
    flat.forEach((n) => {
      if (n.type === 'group') groups.push({ id: n.id, name: n.name });
      else if (n.type === 'division') divisions.push({ id: n.id, name: n.name, groupId: n.parentId ?? '' });
      else if (n.type === 'team') teams.push({ id: n.id, name: n.name, divisionId: n.parentId ?? '' });
    });
    return { groups, divisions, teams };
  }, [flat]);

  const rows = useMemo<Row[]>(() => {
    const list = usersData?.data ?? [];
    return list.map((u) => {
      const d = deptByType(u.departmentId, flat);
      return { user: u, group: d.group, division: d.division, team: d.team, positionLabel: getPositionLabel(u.position, positions) };
    });
  }, [usersData, flat, positions]);

  const [tab, setTab] = useState<'users' | 'org' | 'positions'>('users');
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('전체');
  const [sortKey, setSortKey] = useState<UserSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const [resignTarget, setResignTarget] = useState<Row | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<Row | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState('');
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [nodeModalMode, setNodeModalMode] = useState<OrgNodeModalMode>('create');
  const [nodeParent, setNodeParent] = useState<OrgChartNode | null>(null);
  const [nodeTarget, setNodeTarget] = useState<OrgChartNode | null>(null);
  const [nodeDeleteTarget, setNodeDeleteTarget] = useState<OrgChartNode | null>(null);
  const [nodeDeleting, setNodeDeleting] = useState(false);
  const [confirmReassign, setConfirmReassign] = useState(false);
  const [reassignBusy, setReassignBusy] = useState(false);

  // Part/ P4-① 조직 구조 "구성원 추가" — 선택한 본부/팀을 프리필해 기존 PersonEditModal(배치 API) 재사용.
  const [memberDraft, setMemberDraft] = useState<PersonEditDraft | null>(null);
  const [memberErrors, setMemberErrors] = useState<Partial<Record<keyof PersonEditDraft, string>>>({});
  const [memberSaving, setMemberSaving] = useState(false);

  const [posModalOpen, setPosModalOpen] = useState(false);
  const [posEditTarget, setPosEditTarget] = useState<PositionDef | null>(null);
  const [posDeleteTarget, setPosDeleteTarget] = useState<PositionDef | null>(null);
  const [posDeleting, setPosDeleting] = useState(false);
  const [posMoving, setPosMoving] = useState(false);

  // "부서장 미지정 조직" 클릭 → 조직 구조 보드에서 해당 부서 선택·포커스.
  const [orgFocus, setOrgFocus] = useState<{ deptId: string; seq: number } | null>(null);
  const orgFocusSeq = useRef(0);

  const groupFilterOptions = useMemo(() => ['전체', ...org.groups.map((g) => g.name)], [org.groups]);
  // 팀·직급 칩 필터는 사용자 피드백(2026-07-02)으로 제거 — 컬럼 정렬·검색으로 대체.

  const positionOrder = useMemo(() => {
    const m = new Map<string, number>();
    positions.forEach((p) => m.set(p.code, p.sortOrder));
    return m;
  }, [positions]);

  function handleSort(key: UserSortKey) {
    if (sortKey === key) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    else { setSortKey(key); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      if (filterGroup !== '전체' && r.group !== filterGroup) return false;
      if (search) { const q = search.toLowerCase(); const hay = `${r.user.name} ${r.user.email} ${r.group} ${r.division} ${r.team} ${r.positionLabel}`.toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    });

    if (!sortKey) {
      return list.sort((a, b) => a.user.name.localeCompare(b.user.name, 'ko'));
    }

    const dirMul = sortDir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'group':
          cmp = a.group.localeCompare(b.group, 'ko');
          break;
        case 'division':
          cmp = a.division.localeCompare(b.division, 'ko');
          break;
        case 'team':
          cmp = a.team.localeCompare(b.team, 'ko');
          break;
        case 'position':
          cmp = (positionOrder.get(a.user.position) ?? 999) - (positionOrder.get(b.user.position) ?? 999);
          break;
        case 'hireDate':
          cmp = (a.user.hireDate ?? '').localeCompare(b.user.hireDate ?? '');
          break;
        case 'age':
          // 나이 미상(null)은 항상 뒤로.
          cmp = (a.user.age ?? Number.MAX_SAFE_INTEGER) - (b.user.age ?? Number.MAX_SAFE_INTEGER);
          break;
        case 'status':
          cmp = a.user.employmentStatus.localeCompare(b.user.employmentStatus);
          break;
        default:
          cmp = 0;
      }
      if (cmp === 0) cmp = a.user.name.localeCompare(b.user.name, 'ko');
      return cmp * dirMul;
    });
  }, [rows, filterGroup, search, sortKey, sortDir, positionOrder]);

  // 직급 코드 하드코딩 버킷(이사이상/본부장·팀장/팀원) 폐기 — 커스텀 직급이 어느 버킷에도 안 잡혀
  // 합계가 어긋났다. 재직 상태는 열거형이 닫혀 있어 항상 전체와 합이 맞는다.
  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.user.employmentStatus === 'active').length;
    const onLeave = rows.filter((r) => r.user.employmentStatus === 'on_leave').length;
    const resigned = rows.filter((r) => r.user.employmentStatus === 'resigned').length;
    return { total, active, onLeave, resigned };
  }, [rows]);

  // 서버 전체 인원 — pageSize 하드캡(500)으로 목록이 잘렸는지 판별.
  const serverTotal = usersData?.meta?.total ?? null;

  const orgHealth = useMemo(() => {
    const nodes = Array.from(flat.values());
    const groups = nodes.filter((node) => node.type === 'group').length;
    const divisions = nodes.filter((node) => node.type === 'division').length;
    const teams = nodes.filter((node) => node.type === 'team').length;
    const unassignedUsers = rows.filter((row) => !row.user.departmentId);
    const inactiveUsers = rows.filter((row) => !row.user.isActive);
    const exemptUsers = rows.filter((row) => row.user.evaluationExempt);
    // B-1(2026-07-07) 정합 — 부서장 판정은 role 추론이 아니라 Department.headUserId 명시 지정 단일 기준.
    // 활성 구성원이 있는(하위 포함) 조직인데 head 미지정(또는 head 가 비활성)이면 정리 대상.
    // 그룹도 포함 — 그룹대표 미지정이면 최종(round3) 평가자가 빈다.
    const activeUserIds = new Set(rows.filter((r) => r.user.isActive).map((r) => r.user.id));
    const activeByDept = new Map<string, number>();
    rows.forEach(({ user: u }) => {
      if (u.departmentId && u.isActive) activeByDept.set(u.departmentId, (activeByDept.get(u.departmentId) ?? 0) + 1);
    });
    const headlessNodes: { id: string; name: string }[] = [];
    const walk = (n: OrgChartNode): number => {
      let cnt = activeByDept.get(n.id) ?? 0;
      (n.children ?? []).forEach((c) => { cnt += walk(c); });
      const headOk = !!n.headUserId && activeUserIds.has(n.headUserId);
      if (!headOk && cnt > 0) headlessNodes.push({ id: n.id, name: n.name });
      return cnt;
    };
    (chart?.children ?? []).forEach((g) => walk(g));
    return {
      groups,
      divisions,
      teams,
      unassignedUsers,
      inactiveUsers,
      exemptUsers,
      headlessNodes,
    };
  }, [flat, rows, chart]);

  function resolveDeptId(f: FormState): string | undefined { return f.teamId || f.divisionId || f.groupId || undefined; }

  function rowToForm(r: Row): FormState {
    const u = r.user;
    const node = u.departmentId ? flat.get(u.departmentId) : undefined;
    let groupId = '', divisionId = '', teamId = '';
    if (node) {
      if (node.type === 'team') { teamId = node.id; const p = node.parentId ? flat.get(node.parentId) : undefined; if (p?.type === 'division') { divisionId = p.id; groupId = p.parentId ?? ''; } else if (p?.type === 'group') { groupId = p.id; } }
      else if (node.type === 'division') { divisionId = node.id; groupId = node.parentId ?? ''; }
      else if (node.type === 'group') { groupId = node.id; }
    }
    return { name: u.name, email: u.email, groupId, divisionId, teamId, position: u.position, hireDate: u.hireDate ? u.hireDate.slice(0,10) : '', birthDate: u.birthDate ? u.birthDate.slice(0,10) : '' };
  }

  async function handleAdd(f: FormState) {
    setSaving(true);
    try {
      const deptId = resolveDeptId(f);
      const body: CreateUserRequest = { email: f.email.trim(), name: f.name.trim(), position: f.position as Position, ...(deptId ? { departmentId: deptId } : {}), ...(f.hireDate ? { hireDate: new Date(f.hireDate).toISOString() } : { hireDate: null }), ...(f.birthDate ? { birthDate: new Date(f.birthDate).toISOString() } : { birthDate: null }) };
      await userCommands.create(body);
      toast.success('사용자를 추가했어요.');
      setShowForm(false); reloadUsers();
    } catch (err) { toast.error(err instanceof UserApiError && err.code === 'ALREADY_EXISTS' ? '이미 등록된 이메일이에요.' : err instanceof UserApiError ? err.message : '추가에 실패했어요.', { duration: 8000 }); }
    finally { setSaving(false); }
  }

  async function handleEdit(f: FormState) {
    if (!editTarget) return;
    // 이메일 변경(백엔드 UpdateUserDto.email — 이전 주소 별칭 보존): 바뀐 경우에만 전송, 전송 전 형식 검증.
    const email = f.email.trim().toLowerCase();
    const emailChanged = email !== editTarget.user.email.trim().toLowerCase();
    if (emailChanged && !EMAIL_RE.test(email)) { toast.error('이메일 형식이 올바르지 않아요.', { duration: 8000 }); return; }
    setSaving(true);
    try {
      const deptId = resolveDeptId(f);
      await userCommands.update(editTarget.user.id, { name: f.name.trim(), ...(emailChanged ? { email } : {}), position: f.position as Position, departmentId: deptId ?? null, ...(f.hireDate ? { hireDate: new Date(f.hireDate).toISOString() } : { hireDate: null }), ...(f.birthDate ? { birthDate: new Date(f.birthDate).toISOString() } : { birthDate: null }) } as UpdateUserRequest);
      toast.success('사용자를 수정했어요.');
      setEditTarget(null); reloadUsers();
    } catch (err) { toast.error(err instanceof UserApiError && err.code === 'ALREADY_EXISTS' ? '이미 등록된 이메일이에요.' : err instanceof UserApiError ? err.message : '수정에 실패했어요.', { duration: 8000 }); }
    finally { setSaving(false); }
  }

  async function handleToggleExempt(r: Row) {
    try { await userCommands.update(r.user.id, { evaluationExempt: !r.user.evaluationExempt }); toast.success(r.user.evaluationExempt ? `${r.user.name}님을 평가 대상에 포함했어요.` : `${r.user.name}님을 평가에서 제외했어요.`); reloadUsers(); }
    catch (err) { toast.error(err instanceof UserApiError ? err.message : '처리에 실패했어요.', { duration: 8000 }); }
  }

  async function handleResign() { if (!resignTarget) return; setLifecycleBusy(true); try { await userCommands.resign(resignTarget.user.id); toast.success('퇴사 처리했어요.'); setResignTarget(null); reloadUsers(); } catch (err) { toast.error(err instanceof UserApiError ? err.message : '퇴사 처리에 실패했어요.', { duration: 8000 }); } finally { setLifecycleBusy(false); } }
  async function handleReactivate() { if (!reactivateTarget) return; setLifecycleBusy(true); try { await userCommands.reactivate(reactivateTarget.user.id); toast.success('복직 처리했어요.'); setReactivateTarget(null); reloadUsers(); } catch (err) { toast.error(err instanceof UserApiError ? err.message : '복직 처리에 실패했어요.', { duration: 8000 }); } finally { setLifecycleBusy(false); } }

  async function handleDelete() {
    if (!deleteTarget) return; setLifecycleBusy(true); setDeleteBlocked(null);
    try { await userCommands.remove(deleteTarget.user.id); toast.success('사용자를 삭제했어요.'); setDeleteTarget(null); reloadUsers(); }
    catch (err) { if (err instanceof UserApiError && err.code === 'CONFLICT') { setDeleteBlocked(err.message); } else { toast.error(err instanceof UserApiError ? err.message : '삭제에 실패했어요.', { duration: 8000 }); setDeleteTarget(null); } }
    finally { setLifecycleBusy(false); }
  }

  async function handlePurge() { if (!purgeTarget) return; setLifecycleBusy(true); try { await userCommands.purge(purgeTarget.user.id); toast.success('이력까지 완전 삭제했어요.'); setPurgeTarget(null); setPurgeConfirm(''); reloadUsers(); } catch (err) { toast.error(err instanceof UserApiError ? err.message : '완전 삭제에 실패했어요.', { duration: 8000 }); } finally { setLifecycleBusy(false); } }

  function escalateToPurge() { const t = deleteTarget; setDeleteTarget(null); setDeleteBlocked(null); if (t) { setPurgeTarget(t); setPurgeConfirm(''); } }

  async function submitNode(data: { name: string; type: OrgNodeType; parentId?: string }) {
    try {
      if (nodeModalMode === 'create') { await departmentCommands.create({ name: data.name, type: data.type, parentId: data.parentId }); toast.success('조직을 추가했어요.'); }
      else if (nodeTarget) { await departmentCommands.rename(nodeTarget.id, data.name); toast.success('이름을 변경했어요.'); }
      setNodeModalOpen(false); setNodeParent(null); setNodeTarget(null); reloadChart();
    } catch (err) { toast.error(err instanceof ApiError ? err.message : '저장에 실패했어요.', { duration: 8000 }); }
  }

  async function confirmDeleteNode() { if (!nodeDeleteTarget) return; setNodeDeleting(true); try { await departmentCommands.remove(nodeDeleteTarget.id); toast.success('조직을 삭제했어요.'); setNodeDeleteTarget(null); reloadChart(); } catch (err) { toast.error(err instanceof ApiError ? err.message : '삭제에 실패했어요.', { duration: 8000 }); } finally { setNodeDeleting(false); } }

  // 조직 변경 3종(구성원 이동·조직 이동·부서장 지정)은 평가 배정에 자동 반영되지 않는다 —
  // 부그룹장 지정 토스트와 동일하게 "재배정 실행" 안내를 붙인다(B-1 정합).
  const REASSIGN_HINT = '평가 배정에 반영하려면 부서장 평가 재배정을 실행하세요.';

  async function handleMovePerson(userId: string, deptId: string) {
    const prevDeptId = usersData?.data.find((u) => u.id === userId)?.departmentId ?? null;
    try {
      await userCommands.update(userId, { departmentId: deptId });
      reloadUsers(); reloadChart();
      // 실수 드롭 대비 즉시 되돌리기 — 직전 소속으로 재이동.
      toast.success(`소속을 옮겼어요. ${REASSIGN_HINT}`, {
        action: {
          label: '되돌리기',
          onClick: () => {
            void (async () => {
              try { await userCommands.update(userId, { departmentId: prevDeptId }); toast.success('이동을 되돌렸어요.'); reloadUsers(); reloadChart(); }
              catch (err) { toast.error(err instanceof UserApiError ? err.message : '되돌리기에 실패했어요.', { duration: 8000 }); }
            })();
          },
        },
      });
    } catch (err) { toast.error(err instanceof UserApiError ? err.message : '이동에 실패했어요.', { duration: 8000 }); }
  }
  async function handleMoveDept(deptId: string, parentId: string) {
    const prevParentId = flat.get(deptId)?.parentId ?? null;
    try {
      await departmentCommands.move(deptId, parentId);
      reloadChart(); reloadUsers();
      toast.success(`조직을 옮겼어요. ${REASSIGN_HINT}`, prevParentId ? {
        action: {
          label: '되돌리기',
          onClick: () => {
            void (async () => {
              try { await departmentCommands.move(deptId, prevParentId); toast.success('이동을 되돌렸어요.'); reloadChart(); reloadUsers(); }
              catch (err) { toast.error(err instanceof ApiError ? err.message : '되돌리기에 실패했어요.', { duration: 8000 }); }
            })();
          },
        },
      } : undefined);
    } catch (err) { toast.error(err instanceof ApiError ? err.message : '이동에 실패했어요.', { duration: 8000 }); }
  }
  async function handleSetHead(deptId: string, userId: string) { try { await departmentCommands.setHead(deptId, userId); toast.success(userId ? `부서장을 지정했어요. ${REASSIGN_HINT}` : `부서장 지정을 해제했어요. ${REASSIGN_HINT}`); reloadChart(); } catch (err) { toast.error(err instanceof ApiError ? err.message : '지정에 실패했어요.', { duration: 8000 }); } }
  async function handleSetDeputyHead(deptId: string, userId: string) { try { await departmentCommands.setDeputyHead(deptId, userId); toast.success(userId ? `부그룹장을 지정했어요. ${REASSIGN_HINT}` : `부그룹장 지정을 해제했어요. ${REASSIGN_HINT}`); reloadChart(); } catch (err) { toast.error(err instanceof ApiError ? err.message : '지정에 실패했어요.', { duration: 8000 }); } }
  async function handleReassignOrg() { if (!cycleId) { toast.error('활성 평가 주기가 없어요.', { duration: 8000 }); return; } setReassignBusy(true); try { const res = await evaluationCommands.autoAssignDownward(cycleId, true); toast.success(`부서장 평가를 재배정했어요. 새 배정 ${res.created}건${res.deleted ? ` · 초기화 ${res.deleted}건` : ''}.`); setConfirmReassign(false); } catch (err) { toast.error(err instanceof ApiError ? err.message : '재배정에 실패했어요.', { duration: 8000 }); } finally { setReassignBusy(false); } }

  async function submitPosition(body: CreatePositionRequest | UpdatePositionRequest, id?: string) {
    try {
      if (id) { await positionCommands.update(id, body as UpdatePositionRequest); toast.success('직급을 수정했어요.'); }
      else { await positionCommands.create(body as CreatePositionRequest); toast.success('직급을 추가했어요.'); }
      setPosModalOpen(false); setPosEditTarget(null); reloadPositions();
    } catch (err) { toast.error(err instanceof ApiError && err.code === 'ALREADY_EXISTS' ? '이미 있는 코드/라벨이에요.' : err instanceof ApiError ? err.message : '저장에 실패했어요.', { duration: 8000 }); }
  }

  async function confirmDeletePosition() { if (!posDeleteTarget) return; setPosDeleting(true); try { await positionCommands.remove(posDeleteTarget.id); toast.success('직급을 삭제했어요.'); setPosDeleteTarget(null); reloadPositions(); } catch (err) { toast.error(err instanceof ApiError ? err.message : '삭제에 실패했어요.', { duration: 8000 }); } finally { setPosDeleting(false); } }

  // 직급 순서 위/아래 이동 — 이웃과 sortOrder 스왑(PATCH /positions/:id 는 sortOrder 수정 지원).
  async function handleMovePosition(p: PositionDef, dir: -1 | 1) {
    if (posMoving) return;
    const sorted = [...positions].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((x) => x.id === p.id);
    const other = idx >= 0 ? sorted[idx + dir] : undefined;
    if (!other) return;
    setPosMoving(true);
    try {
      if (p.sortOrder !== other.sortOrder) {
        await positionCommands.update(p.id, { sortOrder: other.sortOrder });
        await positionCommands.update(other.id, { sortOrder: p.sortOrder });
      } else {
        // 동률(스왑 무의미)이면 전체를 10 간격으로 재부여해 순서를 확정한다.
        const reordered = [...sorted];
        reordered.splice(idx, 1);
        reordered.splice(idx + dir, 0, p);
        for (let i = 0; i < reordered.length; i += 1) {
          const want = (i + 1) * 10;
          if (reordered[i].sortOrder !== want) await positionCommands.update(reordered[i].id, { sortOrder: want });
        }
      }
      reloadPositions();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '순서 변경에 실패했어요.', { duration: 8000 });
    } finally { setPosMoving(false); }
  }

  // 선택한 본부/팀 노드를 프리필해 구성원 추가 모달을 연다(P4-①).
  function openAddMember(node: OrgChartNode) {
    let groupId = '', divisionId: string | null = null, teamId: string | null = null;
    if (node.type === 'team') { teamId = node.id; const p = node.parentId ? flat.get(node.parentId) : undefined; if (p?.type === 'division') { divisionId = p.id; groupId = p.parentId ?? ''; } else if (p?.type === 'group') { groupId = p.id; } }
    else if (node.type === 'division') { divisionId = node.id; groupId = node.parentId ?? ''; }
    const position: Position = 'pro';
    setMemberErrors({});
    setMemberDraft({
      name: '', email: '', groupId, divisionId, teamId,
      position, role: defaultRoleForPosition(position),
      visibilityScope: defaultScopeForPosition(position),
      roleOverride: false, scopeOverride: false,
      hireDate: '', birthDate: '',
    });
  }

  async function saveMember() {
    if (!memberDraft) return;
    const errs: Partial<Record<keyof PersonEditDraft, string>> = {};
    if (!memberDraft.name.trim()) errs.name = '이름을 입력해 주세요.';
    if (!memberDraft.email.trim()) errs.email = '이메일을 입력해 주세요.';
    if (!memberDraft.groupId) errs.groupId = '소속 그룹을 선택해 주세요.';
    if (Object.keys(errs).length > 0) { setMemberErrors(errs); return; }
    const deptId = memberDraft.teamId ?? memberDraft.divisionId ?? memberDraft.groupId;
    setMemberSaving(true);
    try {
      const body: CreateUserRequest = {
        email: memberDraft.email.trim(), name: memberDraft.name.trim(),
        position: memberDraft.position, departmentId: deptId,
        role: memberDraft.roleOverride ? memberDraft.role : undefined,
        visibilityScope: memberDraft.scopeOverride ? memberDraft.visibilityScope : undefined,
        // 사용자 추가 폼(UserFormModal)과 필드 정합 — 입사일·생년월일.
        hireDate: memberDraft.hireDate ? new Date(memberDraft.hireDate).toISOString() : null,
        birthDate: memberDraft.birthDate ? new Date(memberDraft.birthDate).toISOString() : null,
      };
      await userCommands.create(body);
      toast.success('구성원을 추가했어요.');
      setMemberDraft(null);
      reloadUsers(); reloadChart();
    } catch (err) {
      if (err instanceof UserApiError && err.code === 'ALREADY_EXISTS') { setMemberErrors({ email: '이미 등록된 이메일이에요.' }); }
      else { toast.error(err instanceof UserApiError ? err.message : '추가에 실패했어요.', { duration: 8000 }); }
    } finally {
      setMemberSaving(false);
    }
  }

  function handleNodeAction(action: 'addChild' | 'rename' | 'delete', node: OrgChartNode) {
    if (action === 'rename') { setNodeModalMode('rename'); setNodeTarget(node); setNodeParent(null); setNodeModalOpen(true); }
    else if (action === 'addChild') { if (node.type === 'team') { toast('팀 아래에는 더 추가할 수 없어요.'); return; } setNodeModalMode('create'); setNodeParent(node); setNodeTarget(null); setNodeModalOpen(true); }
    else { setNodeDeleteTarget(node); }
  }

  const tabItems = [{ key: 'users', label: '사용자 목록' }, { key: 'org', label: '조직 구조' }, { key: 'positions', label: '직급 관리' }];

  const subtitleMap: Record<string, string> = {
    users: '시스템 사용자를 추가·수정하고, 퇴사·복직·삭제를 관리합니다.',
    org: '그룹·본부·팀 조직 구조를 추가·수정·삭제합니다.',
    positions: '직급을 추가·수정·삭제합니다. 기본 직급은 라벨·정렬만 바꿀 수 있어요.',
  };

  const addActionMap: Record<string, () => void> = {
    users: () => setShowForm(true),
    org: () => { setNodeModalMode('create'); setNodeParent(null); setNodeTarget(null); setNodeModalOpen(true); },
    positions: () => { setPosEditTarget(null); setPosModalOpen(true); },
  };
  const addLabelMap: Record<string, string> = { users: '사용자 추가', org: '그룹 추가', positions: '직급 추가' };

  if (!user) return null;
  if (!isAdmin) return <Forbidden message="사용자 관리는 HR 관리자만 접근할 수 있어요." />;
  if (usersError) return <ErrorState onRetry={reloadUsers} message="사용자를 불러오지 못했어요." />;

  return (
    <PageContainer>
      <PageHeader
        title="사용자 관리"
        subtitle={subtitleMap[tab]}
        right={
          <div className="flex items-center gap-2.5 flex-wrap">
            {tab === 'users' && (
              <HeaderMetrics
                items={[
                  { label: '전체 사용자', value: stats.total },
                  { label: '재직', value: stats.active },
                  { label: '휴직', value: stats.onLeave },
                  { label: '퇴사', value: stats.resigned },
                ]}
              />
            )}
            <Button onClick={addActionMap[tab]}>
              <Plus aria-hidden />{addLabelMap[tab]}
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(k) => setTab(k as typeof tab)}>
        <TabsList>
          {tabItems.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {tab === 'users' && (
        <UsersTab
          rows={rows} filtered={filtered}
          search={search} setSearch={setSearch}
          filterGroup={filterGroup} setFilterGroup={setFilterGroup}
          groupFilterOptions={groupFilterOptions}
          sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
          includeInactive={includeInactive} setIncludeInactive={setIncludeInactive}
          loading={usersLoading}
          serverTotal={serverTotal}
          onEdit={(r) => setEditTarget(r)}
          onToggleExempt={(r) => void handleToggleExempt(r)}
          onResign={(r) => setResignTarget(r)}
          onReactivate={(r) => setReactivateTarget(r)}
          onDelete={(r) => { setDeleteBlocked(null); setDeleteTarget(r); }}
          onPurge={(r) => { setPurgeConfirm(''); setPurgeTarget(r); }}
        />
      )}

      {tab === 'org' && (
        <div className="space-y-3">
          <OrgTabPanels
            health={orgHealth}
            memberCount={rows.filter((row) => !!row.user.departmentId).length}
            reassignBusy={reassignBusy}
            onReassign={() => setConfirmReassign(true)}
            onFocusDept={(deptId) => {
              orgFocusSeq.current += 1;
              setOrgFocus({ deptId, seq: orgFocusSeq.current });
            }}
          />

          {chartLoading && !chart ? (
            <div className="rounded-lg border border-border bg-card py-12 text-center text-sm text-muted-foreground">불러오는 중…</div>
          ) : (
            <OrgStructureBoard chart={chart ?? null} users={usersData?.data ?? []} positions={positions} isAdmin={isAdmin} onNodeAction={handleNodeAction} onMovePerson={handleMovePerson} onMoveDept={handleMoveDept} onSetHead={handleSetHead} onSetDeputyHead={handleSetDeputyHead} onAddMember={isAdmin ? openAddMember : undefined} focusRequest={orgFocus} />
          )}
        </div>
      )}

      {tab === 'positions' && (
        <PositionsTab
          positions={positions} loading={positionsLoading}
          onEdit={(p) => { setPosEditTarget(p); setPosModalOpen(true); }}
          onDelete={(p) => setPosDeleteTarget(p)}
          onMove={(p, dir) => void handleMovePosition(p, dir)}
          moving={posMoving}
          posModalOpen={posModalOpen} posEditTarget={posEditTarget}
          onSavePosition={submitPosition}
          onCancelPositionModal={() => { setPosModalOpen(false); setPosEditTarget(null); }}
        />
      )}

      {/* 사용자 추가 폼 */}
      {showForm && <UserFormModal title="사용자 추가" initial={emptyForm()} org={org} positions={activePositions} saving={saving} onSave={handleAdd} onCancel={() => setShowForm(false)} />}
      {/* 사용자 수정 폼 — 이메일도 수정 가능(백엔드가 이전 주소 별칭 보존) */}
      {editTarget && <UserFormModal title="사용자 수정" initial={rowToForm(editTarget)} org={org} positions={activePositions} saving={saving} onSave={handleEdit} onCancel={() => setEditTarget(null)} />}

      <UserLifecycleDialogs
        resignTarget={resignTarget} setResignTarget={setResignTarget}
        reactivateTarget={reactivateTarget} setReactivateTarget={setReactivateTarget}
        deleteTarget={deleteTarget} setDeleteTarget={setDeleteTarget}
        deleteBlocked={deleteBlocked} setDeleteBlocked={setDeleteBlocked}
        purgeTarget={purgeTarget} setPurgeTarget={setPurgeTarget}
        purgeConfirm={purgeConfirm} setPurgeConfirm={setPurgeConfirm}
        busy={lifecycleBusy}
        onResign={() => void handleResign()}
        onReactivate={() => void handleReactivate()}
        onDelete={() => void handleDelete()}
        onEscalateToPurge={escalateToPurge}
        onPurge={() => void handlePurge()}
      />

      <OrgNodeModal open={nodeModalOpen} mode={nodeModalMode} parentNode={nodeParent} targetNode={nodeTarget} onClose={() => { setNodeModalOpen(false); setNodeParent(null); setNodeTarget(null); }} onSubmit={submitNode} />

      {/* 조직 구조 "구성원 추가"(P4-①) — 기존 배치 API(userCommands.create) 재사용 */}
      {memberDraft && (
        <PersonEditModal
          open={!!memberDraft}
          mode="create"
          value={memberDraft}
          groups={org.groups}
          divisions={org.divisions}
          teams={org.teams.map((t) => ({ id: t.id, name: t.name, parentId: t.divisionId }))}
          positions={activePositions}
          errors={memberErrors}
          saving={memberSaving}
          onChange={(patch) => setMemberDraft((d) => (d ? { ...d, ...patch } : d))}
          onSubmit={() => void saveMember()}
          onClose={() => setMemberDraft(null)}
        />
      )}

      <ConfirmDialog open={confirmReassign} onClose={() => { if (!reassignBusy) setConfirmReassign(false); }} title="부서장 평가를 재배정할까요?" primary={{ label: '재배정', loading: reassignBusy, disabled: reassignBusy, onClick: () => void handleReassignOrg() }}>
        <div className="space-y-2 text-sm text-muted-foreground">
          {/* B-1(2026-07-07): 배정 기준은 role 이 아니라 조직 구조의 명시 지정 부서장(headUserId·부그룹장). */}
          <p>아직 시작하지 않은 부서장 평가 배정을 초기화하고, <strong className="text-foreground">조직 구조에 지정된 부서장(팀장·본부장·부그룹장·그룹대표)</strong> 기준으로 다시 배정해요. 조직(소속·부서장 지정)을 바꾼 뒤 사용하세요.</p>
          <p>진행중·제출·확정된 평가는 그대로 보존돼요.{!cycleId && <span className="text-danger-600"> · 활성 평가 주기가 없어요.</span>}</p>
        </div>
      </ConfirmDialog>

      <ConfirmDialog open={nodeDeleteTarget !== null} onClose={() => setNodeDeleteTarget(null)} title="조직을 삭제할까요?" primary={{ label: '삭제', danger: true, loading: nodeDeleting, onClick: () => void confirmDeleteNode() }}>
        <p className="text-sm text-muted-foreground">{nodeDeleteTarget?.name} 을(를) 삭제하면 되돌릴 수 없어요. 구성원이나 하위 조직이 있으면 삭제할 수 없으니, 먼저 옮기거나 비워 주세요.</p>
      </ConfirmDialog>

      <ConfirmDialog open={posDeleteTarget !== null} onClose={() => setPosDeleteTarget(null)} title="직급을 삭제할까요?" primary={{ label: '삭제', danger: true, loading: posDeleting, onClick: () => void confirmDeletePosition() }}>
        <p className="text-sm text-muted-foreground">"{posDeleteTarget?.label}" 직급을 삭제하면 되돌릴 수 없어요. 이 직급을 쓰는 사용자가 있으면 삭제할 수 없으니, 먼저 직급을 변경해 주세요.</p>
      </ConfirmDialog>
    </PageContainer>
  );
}
