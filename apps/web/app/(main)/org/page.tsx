'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgChart } from '@/hooks/useOrgChart';
import { useUsers, userCommands } from '@/hooks/useUsers';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { uploadExcel } from '@/lib/excel';
import { PageHeader } from '@/components/PageHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/Select';
import { OrgTree, type OrgNodeAction } from '@/components/OrgTree';
import { OrgPersonCard } from '@/components/OrgPersonCard';
import { OrgViewToggle } from '@/components/OrgViewToggle';
import { RosterImportPanel } from '@/components/RosterImportPanel';
import {
  PersonEditModal,
  type PersonEditDraft,
} from '@/components/PersonEditModal';
import { ResultTable } from '@/components/ResultTable';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, Spinner, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import {
  flattenOrg,
  deptPath,
  descendantDeptIds,
  defaultRoleForPosition,
  defaultScopeForPosition,
} from '@/lib/org';
import { POSITION_LABEL, SCOPE_LABEL, roleLabel } from '@/lib/ui';
import type {
  User,
  OrgPerson,
  Position,
  ImportResult,
  CreateUserRequest,
  UpdateUserRequest,
} from '@/lib/types';

// 비활성 포함 검색·재직상태 필터.
type ActiveFilter = 'all' | 'active' | 'inactive';

function userToPerson(
  u: User,
  flat: ReturnType<typeof flattenOrg>,
): OrgPerson {
  // 계약 /users 는 표준 User[]. deptPath·override 여부는 트리/직급 기준으로 합성.
  const autoRole = defaultRoleForPosition(u.position);
  const autoScope = defaultScopeForPosition(u.position);
  return {
    id: u.id,
    name: u.name,
    position: u.position,
    email: u.email,
    phone: null, // 계약 User 에 연락처 없음 — 미등록 표시.
    deptId: u.departmentId,
    deptPath: deptPath(u.departmentId, flat),
    role: u.role,
    visibilityScope: u.visibilityScope,
    // hr_admin/company 는 인사총무팀의 자동기본이므로 override 로 오탐하지 않는다.
    roleIsOverride: u.role !== autoRole && u.role !== 'hr_admin',
    scopeIsOverride:
      u.visibilityScope !== autoScope &&
      !(u.role === 'hr_admin' && u.visibilityScope === 'company'),
    active: u.isActive,
    avatarUrl: null,
  };
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

  // 가시 범위 내 전 인원(조직도는 클라에서 노드 필터). 비활성 포함.
  const {
    data: usersData,
    loading: usersLoading,
    error: usersError,
    reload: reloadUsers,
  } = useUsers(
    { includeInactive: true, pageSize: 500 },
    { enabled: !!user },
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'card' | 'list'>('card');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');
  const [positionFilter, setPositionFilter] = useState<string>('all');

  // 모달 상태
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [personOpen, setPersonOpen] = useState(false);
  const [personMode, setPersonMode] = useState<'create' | 'edit'>('create');
  const [personDraft, setPersonDraft] = useState<PersonEditDraft | null>(null);
  const [personErrors, setPersonErrors] = useState<
    Partial<Record<keyof PersonEditDraft, string>>
  >({});
  const [personSaving, setPersonSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);

  const flat = useMemo(() => flattenOrg(chart), [chart]);
  const allUsers = usersData?.data ?? [];

  // 그룹/본부/팀 옵션(PersonEditModal 연쇄 셀렉트).
  const orgOptions = useMemo(() => {
    const groups: { id: string; name: string }[] = [];
    const divisions: { id: string; name: string; groupId: string }[] = [];
    const teams: { id: string; name: string; parentId: string }[] = [];
    flat.forEach((n) => {
      if (n.type === 'group') groups.push({ id: n.id, name: n.name });
      else if (n.type === 'division')
        divisions.push({
          id: n.id,
          name: n.name,
          groupId: n.parentId ?? '',
        });
      else if (n.type === 'team')
        teams.push({ id: n.id, name: n.name, parentId: n.parentId ?? '' });
    });
    return { groups, divisions, teams };
  }, [flat]);

  // 선택 노드(+하위) 인원 필터.
  const visibleDeptIds = useMemo(
    () => descendantDeptIds(chart, selectedNodeId),
    [chart, selectedNodeId],
  );

  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allUsers
      .filter((u) => (visibleDeptIds ? visibleDeptIds.has(u.departmentId) : true))
      .filter((u) =>
        activeFilter === 'all'
          ? true
          : activeFilter === 'active'
            ? u.isActive
            : !u.isActive,
      )
      .filter((u) =>
        positionFilter === 'all' ? true : u.position === positionFilter,
      )
      .filter((u) => {
        if (!q) return true;
        const path = deptPath(u.departmentId, flat).join(' ');
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          path.toLowerCase().includes(q)
        );
      })
      .map((u) => userToPerson(u, flat));
  }, [allUsers, visibleDeptIds, activeFilter, positionFilter, query, flat]);

  const selectedPathLabel = useMemo(() => {
    if (selectedNodeId === null) return chart?.name ?? '전체';
    const path = deptPath(selectedNodeId, flat);
    return path.length ? path.join(' › ') : chart?.name ?? '전체';
  }, [selectedNodeId, flat, chart]);

  // ── 명부 임포트 ──
  async function handleImport(file: File) {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await uploadExcel('/excel/import/roster', file);
      setImportResult(res);
      if (res.ok) {
        toast.show({
          variant: 'success',
          message: `구성원 ${res.imported}명과 조직을 반영했어요.`,
        });
        reloadChart();
        reloadUsers();
      }
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '업로드에 실패했어요.',
      });
    } finally {
      setImporting(false);
    }
  }

  // ── 구성원 추가/수정 ──
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

  function openEdit(u: User) {
    // deptId 가 team/division/group 어디든 될 수 있음 → 상위 체인으로 분해.
    const node = flat.get(u.departmentId);
    let groupId = '';
    let divisionId: string | null = null;
    let teamId: string | null = null;
    if (node) {
      if (node.type === 'team') {
        teamId = node.id;
        const parent = node.parentId ? flat.get(node.parentId) : undefined;
        if (parent?.type === 'division') {
          divisionId = parent.id;
          groupId = parent.parentId ?? '';
        } else if (parent?.type === 'group') {
          groupId = parent.id;
        }
      } else if (node.type === 'division') {
        divisionId = node.id;
        groupId = node.parentId ?? '';
      } else {
        groupId = node.id;
      }
    }
    setPersonMode('edit');
    setPersonErrors({});
    setPersonDraft({
      id: u.id,
      name: u.name,
      email: u.email,
      groupId,
      divisionId,
      teamId,
      position: u.position,
      role: u.role,
      visibilityScope: u.visibilityScope,
      roleOverride: u.role !== defaultRoleForPosition(u.position),
      scopeOverride: u.visibilityScope !== defaultScopeForPosition(u.position),
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
    // 최하위 소속 = 팀 > 본부 > 그룹.
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
          // 오버라이드한 경우만 명시 전송(아니면 백엔드 자동기본).
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

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    try {
      await userCommands.deactivate(deactivateTarget.id);
      toast.show({ variant: 'success', message: '구성원을 비활성화했어요.' });
      reloadChart();
      reloadUsers();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '처리에 실패했어요.',
      });
    } finally {
      setDeactivateTarget(null);
    }
  }

  function handleNodeAction(action: OrgNodeAction) {
    // 조직 노드 CRUD 는 백엔드 계약 미정(요구 "여력 시"). 안내만.
    toast.show({
      variant: 'info',
      message: '조직 노드 편집은 명부 일괄 등록으로 반영해요.',
    });
    void action;
  }

  const personById = (id: string) => allUsers.find((u) => u.id === id);

  if (!user) return null;
  if (chartError)
    return <ErrorState onRetry={reloadChart} message="조직도를 불러오지 못했어요." />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="조직도"
        subtitle={
          chart
            ? `${chart.name} 임직원 ${chart.totalCount}명을 한눈에 볼 수 있어요.`
            : '임직원과 조직을 한눈에 볼 수 있어요.'
        }
        right={
          editable ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setImportResult(null);
                  setImportOpen(true);
                }}
              >
                명부 일괄 등록
              </Button>
              <Button onClick={openCreate}>구성원 추가 +</Button>
            </div>
          ) : undefined
        }
      />

      <InfoBanner tone="tip">
        {editable
          ? '노드를 누르면 해당 조직 구성원이 오른쪽에 나타나요. 카드의 ⋯ 메뉴로 수정·소속 이동·비활성을 할 수 있어요.'
          : '노드를 누르면 해당 조직 구성원이 오른쪽에 나타나요. 보이는 범위는 가시 권한에 따라 달라요.'}
      </InfoBanner>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* 좌 트리 */}
        <div className="lg:w-[300px] lg:shrink-0">
          <OrgTree
            chart={chart}
            selectedNodeId={selectedNodeId}
            query={query}
            onQueryChange={setQuery}
            onSelect={setSelectedNodeId}
            editable={editable}
            onNodeAction={editable ? handleNodeAction : undefined}
            onAddRoot={editable ? () => handleNodeAction('addChild') : undefined}
            loading={chartLoading}
          />
        </div>

        {/* 우 인물 영역 */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">{selectedPathLabel}</span>
              <span className="text-sm font-semibold text-foreground">
                구성원 {filteredPeople.length}명
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                hideLabel
                label="재직 상태"
                value={activeFilter}
                options={[
                  { value: 'active', label: '재직' },
                  { value: 'inactive', label: '비활성' },
                  { value: 'all', label: '전체' },
                ]}
                onChange={(v) => setActiveFilter(v as ActiveFilter)}
              />
              <OrgViewToggle view={view} onChange={setView} />
            </div>
          </div>

          {usersError ? (
            <ErrorState
              onRetry={reloadUsers}
              message="구성원을 불러오지 못했어요."
            />
          ) : usersLoading ? (
            <Spinner />
          ) : filteredPeople.length === 0 ? (
            <EmptyState
              title="이 조직엔 아직 구성원이 없어요."
              action={
                editable ? (
                  <Button onClick={openCreate}>구성원 추가</Button>
                ) : undefined
              }
            />
          ) : view === 'card' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPeople.map((p) => (
                <OrgPersonCard
                  key={p.id}
                  person={p}
                  showAdminMeta={editable}
                  onEdit={
                    editable
                      ? () => {
                          const u = personById(p.id);
                          if (u) openEdit(u);
                        }
                      : undefined
                  }
                  onToggleActive={
                    editable && p.active
                      ? () => {
                          const u = personById(p.id);
                          if (u) setDeactivateTarget(u);
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <Card padding="sm">
              <ResultTable
                columns={[
                  { key: 'name', label: '이름' },
                  { key: 'position', label: '직급' },
                  { key: 'dept', label: '소속' },
                  { key: 'email', label: '이메일' },
                  ...(editable
                    ? [{ key: 'scope', label: '권한' }, { key: 'act', label: '작업', align: 'right' as const }]
                    : []),
                ]}
                rows={filteredPeople.map((p) => ({
                  _key: p.id,
                  name: (
                    <span className={p.active ? '' : 'text-muted-foreground'}>
                      {p.name}
                      {!p.active && (
                        <Badge variant="outline" className="ml-2 text-muted-foreground">
                          비활성
                        </Badge>
                      )}
                    </span>
                  ),
                  position: POSITION_LABEL[p.position],
                  dept: p.deptPath.join(' › ') || '소속 미지정',
                  email: (
                    <a href={`mailto:${p.email}`} className="text-primary hover:underline">
                      {p.email}
                    </a>
                  ),
                  scope: `${roleLabel[p.role]} · ${SCOPE_LABEL[p.visibilityScope]}`,
                  act: editable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const u = personById(p.id);
                        if (u) openEdit(u);
                      }}
                    >
                      수정
                    </Button>
                  ) : null,
                }))}
              />
            </Card>
          )}
        </div>
      </div>

      {/* 명부 일괄 등록 */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="명부 일괄 등록"
        size="lg"
        secondaryAction={{ label: '닫기', onClick: () => setImportOpen(false) }}
      >
        <RosterImportPanel
          uploading={importing}
          result={importResult}
          onSelect={(file) => void handleImport(file)}
          onClear={() => setImportResult(null)}
        />
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
          onDeactivate={
            personMode === 'edit' && personDraft.id
              ? () => {
                  const u = personById(personDraft.id as string);
                  if (u) {
                    setPersonOpen(false);
                    setDeactivateTarget(u);
                  }
                }
              : undefined
          }
        />
      )}

      {/* 비활성화 확인 */}
      <Modal
        open={deactivateTarget !== null}
        onClose={() => setDeactivateTarget(null)}
        title="구성원을 비활성화할까요?"
        primaryAction={{
          label: '비활성화',
          variant: 'danger',
          onClick: () => void confirmDeactivate(),
        }}
        secondaryAction={{ label: '취소', onClick: () => setDeactivateTarget(null) }}
      >
        {deactivateTarget?.name} 님을 비활성화하면 로그인과 평가 대상에서
        제외돼요. 데이터는 보존되며 다시 활성화할 수 있어요.
      </Modal>

      {chartLoading && !chart && <Skeleton className="h-32 w-full" />}
    </div>
  );
}
