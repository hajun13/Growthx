'use client';

/**
 * AdminUsersView — 사용자 관리 페이지 (hr_admin).
 * 오케스트레이터: 상태·핸들러 집중, UI는 UsersTab / PositionsTab / OrgStructureBoard 위임.
 * DS: PageContainer, PageHeader, Tabs, Button, Modal.
 * 인라인 style/hex 제거. 파일상한 ~200줄 준수.
 */

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUsers } from '../hooks';
import { userCommands, ApiError as UserApiError } from '../api';
import { useOrgChart } from '@/hooks/useOrgChart';
import { departmentCommands } from '@/hooks/useDepartments';
import { usePositions, positionCommands } from '@/hooks/usePositions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { evaluationCommands } from '@/hooks/useEvaluations';
import { OrgStructureBoard } from '@/components/OrgStructureBoard';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Forbidden, ErrorState } from '@/components/States';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Tabs } from '@/components/Tabs';
import { Modal } from '@/components/Modal';
import { OrgNodeModal, type OrgNodeModalMode } from '@/components/OrgNodeModal';
import { isHrAdmin } from '@/lib/nav';
import { flattenOrg, deptByType } from '@/lib/org';
import { getPositionLabel } from '@/lib/ui';
import type {
  User, Position, PositionDef, OrgChartNode, OrgNodeType,
  CreateUserRequest, UpdateUserRequest,
  CreatePositionRequest, UpdatePositionRequest,
} from '@/lib/types';

import { UserFormModal, type FormState } from './UserFormModal';
import { LifecycleConfirmModal } from './LifecycleConfirmModal';
import { UsersTab } from './UsersTab';
import { PositionsTab } from './PositionsTab';

interface Row { user: User; group: string; division: string; team: string; positionLabel: string; }
interface OrgOptions { groups: { id: string; name: string }[]; divisions: { id: string; name: string; groupId: string }[]; teams: { id: string; name: string; divisionId: string }[]; }

function emptyForm(): FormState {
  return { name: '', email: '', groupId: '', divisionId: '', teamId: '', position: '', hireDate: '', birthDate: '' };
}

export function AdminUsersView() {
  const { user } = useAuth();
  const toast = useToast();
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

  const [posModalOpen, setPosModalOpen] = useState(false);
  const [posEditTarget, setPosEditTarget] = useState<PositionDef | null>(null);
  const [posDeleteTarget, setPosDeleteTarget] = useState<PositionDef | null>(null);
  const [posDeleting, setPosDeleting] = useState(false);

  const groupFilterOptions = useMemo(() => ['전체', ...org.groups.map((g) => g.name)], [org.groups]);

  const filtered = useMemo(() =>
    rows.filter((r) => {
      if (filterGroup !== '전체' && r.group !== filterGroup) return false;
      if (search) { const q = search.toLowerCase(); const hay = `${r.user.name} ${r.user.email} ${r.team} ${r.division}`.toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    }).sort((a, b) => a.user.name.localeCompare(b.user.name, 'ko')),
  [rows, filterGroup, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const exec = rows.filter((r) => ['ceo','vice_president','executive','director'].includes(r.user.position)).length;
    const lead = rows.filter((r) => ['division_head','team_lead'].includes(r.user.position)).length;
    const member = rows.filter((r) => ['principal','chief','senior','pro'].includes(r.user.position)).length;
    return { total, exec, lead, member };
  }, [rows]);

  const orgHealth = useMemo(() => {
    const nodes = Array.from(flat.values());
    const groups = nodes.filter((node) => node.type === 'group').length;
    const divisions = nodes.filter((node) => node.type === 'division').length;
    const teams = nodes.filter((node) => node.type === 'team').length;
    const unassignedUsers = rows.filter((row) => !row.user.departmentId);
    const inactiveUsers = rows.filter((row) => !row.user.isActive);
    const exemptUsers = rows.filter((row) => row.user.evaluationExempt);
    const headlessNodes = nodes.filter((node) => {
      if (node.type === 'group') return false;
      const expectedRole = node.type === 'team' ? 'team_lead' : 'division_head';
      return !rows.some(
        (row) => row.user.departmentId === node.id && row.user.role === expectedRole,
      );
    });
    return {
      groups,
      divisions,
      teams,
      unassignedUsers,
      inactiveUsers,
      exemptUsers,
      headlessNodes,
    };
  }, [flat, rows]);

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
      toast.show({ variant: 'success', message: '사용자를 추가했어요.' });
      setShowForm(false); reloadUsers();
    } catch (err) { toast.show({ variant: 'danger', message: err instanceof UserApiError && err.code === 'ALREADY_EXISTS' ? '이미 등록된 이메일이에요.' : err instanceof UserApiError ? err.message : '추가에 실패했어요.' }); }
    finally { setSaving(false); }
  }

  async function handleEdit(f: FormState) {
    if (!editTarget) return;
    setSaving(true);
    try {
      const deptId = resolveDeptId(f);
      await userCommands.update(editTarget.user.id, { name: f.name.trim(), position: f.position as Position, departmentId: deptId ?? null, ...(f.hireDate ? { hireDate: new Date(f.hireDate).toISOString() } : { hireDate: null }), ...(f.birthDate ? { birthDate: new Date(f.birthDate).toISOString() } : { birthDate: null }) } as UpdateUserRequest);
      toast.show({ variant: 'success', message: '사용자를 수정했어요.' });
      setEditTarget(null); reloadUsers();
    } catch (err) { toast.show({ variant: 'danger', message: err instanceof UserApiError ? err.message : '수정에 실패했어요.' }); }
    finally { setSaving(false); }
  }

  async function handleToggleExempt(r: Row) {
    try { await userCommands.update(r.user.id, { evaluationExempt: !r.user.evaluationExempt }); toast.show({ variant: 'success', message: r.user.evaluationExempt ? `${r.user.name}님을 평가 대상에 포함했어요.` : `${r.user.name}님을 평가에서 제외했어요.` }); reloadUsers(); }
    catch (err) { toast.show({ variant: 'danger', message: err instanceof UserApiError ? err.message : '처리에 실패했어요.' }); }
  }

  async function handleResign() { if (!resignTarget) return; setLifecycleBusy(true); try { await userCommands.resign(resignTarget.user.id); toast.show({ variant: 'success', message: '퇴사 처리했어요.' }); setResignTarget(null); reloadUsers(); } catch (err) { toast.show({ variant: 'danger', message: err instanceof UserApiError ? err.message : '퇴사 처리에 실패했어요.' }); } finally { setLifecycleBusy(false); } }
  async function handleReactivate() { if (!reactivateTarget) return; setLifecycleBusy(true); try { await userCommands.reactivate(reactivateTarget.user.id); toast.show({ variant: 'success', message: '복직 처리했어요.' }); setReactivateTarget(null); reloadUsers(); } catch (err) { toast.show({ variant: 'danger', message: err instanceof UserApiError ? err.message : '복직 처리에 실패했어요.' }); } finally { setLifecycleBusy(false); } }

  async function handleDelete() {
    if (!deleteTarget) return; setLifecycleBusy(true); setDeleteBlocked(null);
    try { await userCommands.remove(deleteTarget.user.id); toast.show({ variant: 'success', message: '사용자를 삭제했어요.' }); setDeleteTarget(null); reloadUsers(); }
    catch (err) { if (err instanceof UserApiError && err.code === 'CONFLICT') { setDeleteBlocked(err.message); } else { toast.show({ variant: 'danger', message: err instanceof UserApiError ? err.message : '삭제에 실패했어요.' }); setDeleteTarget(null); } }
    finally { setLifecycleBusy(false); }
  }

  async function handlePurge() { if (!purgeTarget) return; setLifecycleBusy(true); try { await userCommands.purge(purgeTarget.user.id); toast.show({ variant: 'success', message: '이력까지 완전 삭제했어요.' }); setPurgeTarget(null); setPurgeConfirm(''); reloadUsers(); } catch (err) { toast.show({ variant: 'danger', message: err instanceof UserApiError ? err.message : '완전 삭제에 실패했어요.' }); } finally { setLifecycleBusy(false); } }

  function escalateToPurge() { const t = deleteTarget; setDeleteTarget(null); setDeleteBlocked(null); if (t) { setPurgeTarget(t); setPurgeConfirm(''); } }

  async function submitNode(data: { name: string; type: OrgNodeType; parentId?: string }) {
    try {
      if (nodeModalMode === 'create') { await departmentCommands.create({ name: data.name, type: data.type, parentId: data.parentId }); toast.show({ variant: 'success', message: '조직을 추가했어요.' }); }
      else if (nodeTarget) { await departmentCommands.rename(nodeTarget.id, data.name); toast.show({ variant: 'success', message: '이름을 변경했어요.' }); }
      setNodeModalOpen(false); setNodeParent(null); setNodeTarget(null); reloadChart();
    } catch (err) { toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '저장에 실패했어요.' }); }
  }

  async function confirmDeleteNode() { if (!nodeDeleteTarget) return; setNodeDeleting(true); try { await departmentCommands.remove(nodeDeleteTarget.id); toast.show({ variant: 'success', message: '조직을 삭제했어요.' }); setNodeDeleteTarget(null); reloadChart(); } catch (err) { toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '삭제에 실패했어요.' }); } finally { setNodeDeleting(false); } }

  async function handleMovePerson(userId: string, deptId: string) { try { await userCommands.update(userId, { departmentId: deptId }); toast.show({ variant: 'success', message: '소속을 옮겼어요.' }); reloadUsers(); reloadChart(); } catch (err) { toast.show({ variant: 'danger', message: err instanceof UserApiError ? err.message : '이동에 실패했어요.' }); } }
  async function handleMoveDept(deptId: string, parentId: string) { try { await departmentCommands.move(deptId, parentId); toast.show({ variant: 'success', message: '조직을 옮겼어요.' }); reloadChart(); reloadUsers(); } catch (err) { toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '이동에 실패했어요.' }); } }
  async function handleSetHead(deptId: string, userId: string) { try { await departmentCommands.setHead(deptId, userId); toast.show({ variant: 'success', message: userId ? '부서장을 지정했어요.' : '부서장 지정을 해제했어요.' }); reloadChart(); } catch (err) { toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '지정에 실패했어요.' }); } }
  async function handleReassignOrg() { if (!cycleId) { toast.show({ variant: 'danger', message: '활성 평가 주기가 없어요.' }); return; } setReassignBusy(true); try { const res = await evaluationCommands.autoAssignDownward(cycleId, true); toast.show({ variant: 'success', message: `부서장 평가를 재배정했어요. 새 배정 ${res.created}건${res.deleted ? ` · 초기화 ${res.deleted}건` : ''}.` }); setConfirmReassign(false); } catch (err) { toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '재배정에 실패했어요.' }); } finally { setReassignBusy(false); } }

  async function submitPosition(body: CreatePositionRequest | UpdatePositionRequest, id?: string) {
    try {
      if (id) { await positionCommands.update(id, body as UpdatePositionRequest); toast.show({ variant: 'success', message: '직급을 수정했어요.' }); }
      else { await positionCommands.create(body as CreatePositionRequest); toast.show({ variant: 'success', message: '직급을 추가했어요.' }); }
      setPosModalOpen(false); setPosEditTarget(null); reloadPositions();
    } catch (err) { toast.show({ variant: 'danger', message: err instanceof ApiError && err.code === 'ALREADY_EXISTS' ? '이미 있는 코드/라벨이에요.' : err instanceof ApiError ? err.message : '저장에 실패했어요.' }); }
  }

  async function confirmDeletePosition() { if (!posDeleteTarget) return; setPosDeleting(true); try { await positionCommands.remove(posDeleteTarget.id); toast.show({ variant: 'success', message: '직급을 삭제했어요.' }); setPosDeleteTarget(null); reloadPositions(); } catch (err) { toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '삭제에 실패했어요.' }); } finally { setPosDeleting(false); } }

  function handleNodeAction(action: 'addChild' | 'rename' | 'delete', node: OrgChartNode) {
    if (action === 'rename') { setNodeModalMode('rename'); setNodeTarget(node); setNodeParent(null); setNodeModalOpen(true); }
    else if (action === 'addChild') { if (node.type === 'team') { toast.show({ variant: 'info', message: '팀 아래에는 더 추가할 수 없어요.' }); return; } setNodeModalMode('create'); setNodeParent(node); setNodeTarget(null); setNodeModalOpen(true); }
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
                  { label: '이사 이상', value: stats.exec },
                  { label: '본부장·팀장', value: stats.lead },
                  { label: '팀원', value: stats.member },
                ]}
              />
            )}
            <Button variant="primary" leftIcon={<Plus size={14} aria-hidden />} onClick={addActionMap[tab]}>
              {addLabelMap[tab]}
            </Button>
          </div>
        }
      />

      <Tabs items={tabItems} activeKey={tab} onChange={(k) => setTab(k as typeof tab)} />

      {tab === 'users' && (
        <UsersTab
          rows={rows} filtered={filtered} stats={stats}
          search={search} setSearch={setSearch}
          filterGroup={filterGroup} setFilterGroup={setFilterGroup}
          groupFilterOptions={groupFilterOptions}
          includeInactive={includeInactive} setIncludeInactive={setIncludeInactive}
          loading={usersLoading}
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
          <div className="gx-workbench-grid">
            <Card
              title={
                <span className="flex items-center gap-2">
                  <Building2 size={16} className="text-primary" aria-hidden />
                  조직 구조 (그룹 → 본부 → 팀)
                </span>
              }
              action={
                <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={13} aria-hidden />} loading={reassignBusy} onClick={() => setConfirmReassign(true)}>
                  부서장 평가 재배정
                </Button>
              }
            >
              <div className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
                <OrgMetric label="그룹" value={`${orgHealth.groups}개`} />
                <OrgMetric label="본부" value={`${orgHealth.divisions}개`} />
                <OrgMetric label="팀" value={`${orgHealth.teams}개`} />
                <OrgMetric label="소속 인원" value={`${rows.filter((row) => !!row.user.departmentId).length}명`} />
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                트리에서 부서를 선택하면 상세가 열립니다. 조직 변경 후에는 시작 전 부서장 평가만 재배정할 수 있습니다.
              </p>
            </Card>

            <Card title="정리해야 할 항목">
              <div className="space-y-3">
                <OrgIssue
                  ok={orgHealth.unassignedUsers.length === 0}
                  title="소속 미지정 사용자"
                  value={`${orgHealth.unassignedUsers.length}명`}
                  text={
                    orgHealth.unassignedUsers.length === 0
                      ? '모든 사용자가 조직에 연결되어 있습니다.'
                      : orgHealth.unassignedUsers.slice(0, 3).map((row) => row.user.name).join(', ')
                  }
                />
                <OrgIssue
                  ok={orgHealth.headlessNodes.length === 0}
                  title="부서장 미지정 조직"
                  value={`${orgHealth.headlessNodes.length}개`}
                  text={
                    orgHealth.headlessNodes.length === 0
                      ? '본부/팀의 부서장 지정 상태가 정리되어 있습니다.'
                      : orgHealth.headlessNodes.slice(0, 3).map((node) => node.name).join(', ')
                  }
                />
                <OrgIssue
                  ok={orgHealth.inactiveUsers.length === 0 && orgHealth.exemptUsers.length === 0}
                  title="평가 대상 예외"
                  value={`${orgHealth.inactiveUsers.length + orgHealth.exemptUsers.length}명`}
                  text={`비활성 ${orgHealth.inactiveUsers.length}명 · 평가제외 ${orgHealth.exemptUsers.length}명`}
                />
              </div>
            </Card>
          </div>

          {chartLoading && !chart ? (
            <div className="rounded-none border border-border bg-card py-12 text-center text-sm text-muted-foreground">불러오는 중…</div>
          ) : (
            <OrgStructureBoard chart={chart ?? null} users={usersData?.data ?? []} positions={positions} isAdmin={isAdmin} onNodeAction={handleNodeAction} onMovePerson={handleMovePerson} onMoveDept={handleMoveDept} onSetHead={handleSetHead} />
          )}
        </div>
      )}

      {tab === 'positions' && (
        <PositionsTab
          positions={positions} loading={positionsLoading}
          onEdit={(p) => { setPosEditTarget(p); setPosModalOpen(true); }}
          onDelete={(p) => setPosDeleteTarget(p)}
          posModalOpen={posModalOpen} posEditTarget={posEditTarget}
          onSavePosition={submitPosition}
          onCancelPositionModal={() => { setPosModalOpen(false); setPosEditTarget(null); }}
        />
      )}

      {/* 사용자 추가 폼 */}
      {showForm && <UserFormModal title="사용자 추가" initial={emptyForm()} org={org} positions={activePositions} saving={saving} onSave={handleAdd} onCancel={() => setShowForm(false)} />}
      {/* 사용자 수정 폼 */}
      {editTarget && <UserFormModal title="사용자 수정" initial={rowToForm(editTarget)} org={org} positions={activePositions} saving={saving} onSave={handleEdit} onCancel={() => setEditTarget(null)} />}

      {/* 퇴사 확인 */}
      {resignTarget && (
        <LifecycleConfirmModal title="퇴사 처리할까요?" onCancel={() => setResignTarget(null)} confirmLabel="퇴사 처리" confirmVariant="danger" busy={lifecycleBusy} onConfirm={() => void handleResign()}>
          <p className="text-sm text-muted-foreground leading-relaxed"><strong className="text-foreground">{resignTarget.user.name}</strong> ({resignTarget.team || resignTarget.division || resignTarget.group || '소속 미지정'} · {resignTarget.positionLabel})을(를) 퇴사 처리합니다.<br />비활성으로 전환되어 로그인할 수 없게 되고, 평가 이력은 보존됩니다.</p>
        </LifecycleConfirmModal>
      )}

      {/* 복직 확인 */}
      {reactivateTarget && (
        <LifecycleConfirmModal title="복직 처리할까요?" onCancel={() => setReactivateTarget(null)} confirmLabel="복직 처리" confirmVariant="primary" busy={lifecycleBusy} onConfirm={() => void handleReactivate()}>
          <p className="text-sm text-muted-foreground leading-relaxed"><strong className="text-foreground">{reactivateTarget.user.name}</strong>님을 다시 활성 상태로 전환합니다. 재직 상태가 '재직'으로 바뀌고 로그인할 수 있어요.</p>
        </LifecycleConfirmModal>
      )}

      {/* 삭제 확인 */}
      {deleteTarget && (
        <LifecycleConfirmModal title="사용자를 삭제할까요?" onCancel={() => { setDeleteTarget(null); setDeleteBlocked(null); }} confirmLabel={deleteBlocked ? '완전 삭제로 전환' : '삭제'} confirmVariant="danger" busy={lifecycleBusy} onConfirm={deleteBlocked ? escalateToPurge : () => void handleDelete()}>
          <p className="text-sm text-muted-foreground leading-relaxed"><strong className="text-foreground">{deleteTarget.user.name}</strong> ({deleteTarget.positionLabel}) 계정을 삭제합니다. 평가 이력이 없으면 바로 삭제돼요.</p>
          {deleteBlocked && (
            <div className="mt-3 rounded-none border border-danger-400/30 bg-danger-50 px-4 py-3 text-[12.5px] text-foreground leading-relaxed">
              {deleteBlocked}<br /><span className="font-semibold text-danger-600">이력까지 지우려면 '완전 삭제로 전환'을 누르세요.</span>
            </div>
          )}
        </LifecycleConfirmModal>
      )}

      {/* 완전 삭제 확인 */}
      {purgeTarget && (
        <LifecycleConfirmModal title="이력까지 완전 삭제할까요?" onCancel={() => { setPurgeTarget(null); setPurgeConfirm(''); }} confirmLabel="완전 삭제" confirmVariant="danger" busy={lifecycleBusy} disabled={purgeConfirm.trim() !== purgeTarget.user.name} onConfirm={() => void handlePurge()}>
          <div className="rounded-none border border-danger-400/30 bg-danger-50 px-4 py-3 text-[12.5px] text-foreground leading-relaxed">
            <strong className="text-danger-600">되돌릴 수 없는 작업이에요.</strong> <strong>{purgeTarget.user.name}</strong>님의 평가 이력(결과·KPI·보상 등)이 함께 영구 삭제됩니다.
          </div>
          <div className="mt-4">
            <label className="block mb-1.5 text-xs font-semibold text-muted-foreground">확인을 위해 이름 <span className="text-danger-600">"{purgeTarget.user.name}"</span>을(를) 입력하세요.</label>
            <input value={purgeConfirm} onChange={(e) => setPurgeConfirm(e.target.value)} placeholder={purgeTarget.user.name} autoFocus className="w-full rounded-none border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
          </div>
        </LifecycleConfirmModal>
      )}

      <OrgNodeModal open={nodeModalOpen} mode={nodeModalMode} parentNode={nodeParent} targetNode={nodeTarget} onClose={() => { setNodeModalOpen(false); setNodeParent(null); setNodeTarget(null); }} onSubmit={submitNode} />

      <Modal open={confirmReassign} onClose={() => { if (!reassignBusy) setConfirmReassign(false); }} title="부서장 평가를 재배정할까요?" primaryAction={{ label: '재배정', loading: reassignBusy, disabled: reassignBusy, onClick: () => void handleReassignOrg() }} secondaryAction={{ label: '취소', onClick: () => setConfirmReassign(false) }}>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>아직 시작하지 않은 부서장 평가 배정을 초기화하고, <strong className="text-foreground">현재 팀장·본부장 권한</strong> 기준으로 다시 배정해요. 조직(소속·팀장)을 바꾼 뒤 사용하세요.</p>
          <p>진행중·제출·확정된 평가는 그대로 보존돼요.{!cycleId && <span className="text-danger-600"> · 활성 평가 주기가 없어요.</span>}</p>
        </div>
      </Modal>

      <Modal open={nodeDeleteTarget !== null} onClose={() => setNodeDeleteTarget(null)} title="조직을 삭제할까요?" primaryAction={{ label: '삭제', variant: 'danger', loading: nodeDeleting, onClick: () => void confirmDeleteNode() }} secondaryAction={{ label: '취소', onClick: () => setNodeDeleteTarget(null) }}>
        <p className="text-sm text-muted-foreground">{nodeDeleteTarget?.name} 을(를) 삭제하면 되돌릴 수 없어요. 구성원이나 하위 조직이 있으면 삭제할 수 없으니, 먼저 옮기거나 비워 주세요.</p>
      </Modal>

      <Modal open={posDeleteTarget !== null} onClose={() => setPosDeleteTarget(null)} title="직급을 삭제할까요?" primaryAction={{ label: '삭제', variant: 'danger', loading: posDeleting, onClick: () => void confirmDeletePosition() }} secondaryAction={{ label: '취소', onClick: () => setPosDeleteTarget(null) }}>
        <p className="text-sm text-muted-foreground">"{posDeleteTarget?.label}" 직급을 삭제하면 되돌릴 수 없어요. 이 직급을 쓰는 사용자가 있으면 삭제할 수 없으니, 먼저 직급을 변경해 주세요.</p>
      </Modal>
    </PageContainer>
  );
}

function OrgMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-[16px] font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function OrgIssue({
  ok,
  title,
  value,
  text,
}: {
  ok: boolean;
  title: string;
  value: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={
          ok
            ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-primary bg-primary text-primary-foreground'
            : 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-warning-300 bg-warning-50 text-warning-700'
        }
      >
        {ok ? <CheckCircle2 size={13} aria-hidden /> : <AlertTriangle size={13} aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-bold text-foreground">{title}</span>
          <span className="text-[12px] font-bold tabular-nums text-muted-foreground">{value}</span>
        </span>
        <span className="mt-0.5 block truncate text-[12px] leading-relaxed text-muted-foreground">{text}</span>
      </span>
    </div>
  );
}
