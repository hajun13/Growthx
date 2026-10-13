'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUsers, userCommands } from '@/hooks/useUsers';
import { usePositions } from '@/hooks/usePositions';
import { ApiError } from '@/lib/api';
import { departmentCommands } from '@/hooks/useDepartments';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { OrgNodeModal, type OrgNodeModalMode } from '@/components/OrgNodeModal';
import { PersonEditModal, type PersonEditDraft } from '@/components/PersonEditModal';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
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
import { OrgNodeCard } from './OrgChartCard';
import { OrgListView } from './OrgListView';
import { OrgEmpty } from './OrgEmpty';

/* ── 메인 View ── */
export function OrgView() {
  const { user } = useAuth();
  const editable = !!user && isHrAdmin(user.role);

  const { data: chart, loading: chartLoading, error: chartError, reload: reloadChart } = useOrgChartData(!!user);
  const { data: usersData, reload: reloadUsers } = useUsers({ includeInactive: true, pageSize: 500 }, { enabled: !!user });
  const { data: positionsData } = usePositions({}, { enabled: !!user });

  const [view, setView] = useState<'chart' | 'list'>('chart');

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
  const orgSummary = useMemo(() => {
    const nodes = Array.from(flat.values());
    const users = usersData?.data ?? [];
    return {
      groups: nodes.filter((node) => node.type === 'group').length,
      divisions: nodes.filter((node) => node.type === 'division').length,
      teams: nodes.filter((node) => node.type === 'team').length,
      activeUsers: users.filter((item) => item.isActive).length,
      unassignedUsers: users.filter((item) => !item.departmentId).length,
    };
  }, [flat, usersData?.data]);

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
      hireDate: '', birthDate: '',
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
          hireDate: personDraft.hireDate ? new Date(personDraft.hireDate).toISOString() : null,
          birthDate: personDraft.birthDate ? new Date(personDraft.birthDate).toISOString() : null,
        };
        await userCommands.create(body);
        toast.success('구성원을 추가했어요.');
      } else if (personDraft.id) {
        const body: UpdateUserRequest = {
          name: personDraft.name.trim(), position: personDraft.position,
          departmentId, role: personDraft.role, visibilityScope: personDraft.visibilityScope,
          hireDate: personDraft.hireDate ? new Date(personDraft.hireDate).toISOString() : null,
          birthDate: personDraft.birthDate ? new Date(personDraft.birthDate).toISOString() : null,
        };
        await userCommands.update(personDraft.id, body);
        toast.success('구성원을 수정했어요.');
      }
      setPersonOpen(false);
      setPersonDraft(null);
      reloadChart();
      reloadUsers();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_EXISTS') {
        setPersonErrors({ email: '이미 등록된 이메일이에요.' });
      } else {
        toast.error(err instanceof ApiError ? err.message : '저장에 실패했어요.', { duration: 8000 });
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
      if (node.type === 'team') { toast('팀 아래에는 더 추가할 수 없어요.'); return; }
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
        toast.success('조직을 추가했어요.');
      } else if (nodeTarget) {
        await departmentCommands.rename(nodeTarget.id, data.name);
        toast.success('이름을 변경했어요.');
      }
      setNodeModalOpen(false);
      setNodeParent(null);
      setNodeTarget(null);
      reloadChart();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '저장에 실패했어요.', { duration: 8000 });
    }
  }

  async function confirmDeleteNode() {
    if (!deleteTarget) return;
    setNodeDeleting(true);
    try {
      await departmentCommands.remove(deleteTarget.id);
      toast.success('조직을 삭제했어요.');
      setDeleteTarget(null);
      reloadChart();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '삭제에 실패했어요.', { duration: 8000 });
    } finally {
      setNodeDeleting(false);
    }
  }

  if (!user) return null;
  if (chartError) {
    return (
      <Alert variant="destructive" className="flex flex-col items-start gap-3">
        <AlertTriangle aria-hidden />
        <div>
          <AlertTitle>문제가 발생했어요</AlertTitle>
          <AlertDescription>조직도를 불러오지 못했어요.</AlertDescription>
        </div>
        <Button variant="outline" size="sm" onClick={reloadChart}>
          다시 시도
        </Button>
      </Alert>
    );
  }

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
              <Button size="sm" onClick={openCreate}>
                구성원 추가 +
              </Button>
            )}
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={view}
              // 같은 항목 재클릭 시 Radix 가 빈 값을 내보냄 — 선택 해제 불가(라디오 동작) 유지.
              onValueChange={(v) => v && setView(v as typeof view)}
              aria-label="조직도 보기 전환"
            >
              <ToggleGroupItem value="chart">조직도</ToggleGroupItem>
              <ToggleGroupItem value="list">목록</ToggleGroupItem>
            </ToggleGroup>
          </div>
        }
      />

      <div className="gx-workbench-grid">
        <TitledCard title="조직 현황">
          <div className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-5">
            <OrgSummaryCell label="그룹" value={`${orgSummary.groups}개`} />
            <OrgSummaryCell label="본부" value={`${orgSummary.divisions}개`} />
            <OrgSummaryCell label="팀" value={`${orgSummary.teams}개`} />
            <OrgSummaryCell label="재직자" value={`${orgSummary.activeUsers}명`} />
            <OrgSummaryCell label="소속 미지정" value={`${orgSummary.unassignedUsers}명`} />
          </div>
        </TitledCard>

        <TitledCard title="보기 흐름">
          <div className="space-y-2 text-12 leading-relaxed text-muted-foreground">
            <p><strong className="text-foreground">조직도</strong>는 그룹→본부→팀 구조와 직속 인원을 빠르게 확인합니다.</p>
            <p><strong className="text-foreground">목록</strong>은 조직 단위별 인원을 비교할 때 사용합니다.</p>
            <p>역할별 열람 범위(가시성)는 <strong className="text-foreground">권한 관리 → '가시성 설정' 탭</strong>에서 관리합니다.</p>
          </div>
        </TitledCard>
      </div>

      {view === 'chart' && (
        <Card>
          <CardContent className="p-4 md:p-5">
            {chartLoading && !chart ? (
              <Skeleton className="h-48 w-full" />
            ) : !chart ? (
              <OrgEmpty
                title="조직이 아직 없어요."
                action={editable ? <Button size="sm" onClick={openAddRoot}>그룹 추가</Button> : undefined}
              />
            ) : (
              <div className="overflow-x-auto">
                <div className="flex min-w-max justify-center py-4">
                  <OrgNodeCard
                    node={chart}
                    level={0}
                    editable={editable}
                    onAction={handleNodeAction}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {view === 'list' && <OrgListView chart={chart} />}

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
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent size="sm" layout="scroll-footer">
          <DialogHeader>
            <DialogTitle>조직을 삭제할까요?</DialogTitle>
          </DialogHeader>
          <DialogDescription className="min-h-0 overflow-y-auto text-sm text-foreground">
            {deleteTarget?.name} 을(를) 삭제하면 되돌릴 수 없어요. 구성원이나 하위
            조직이 있으면 삭제할 수 없으니, 먼저 옮기거나 비워 주세요.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button variant="destructive" loading={nodeDeleting} onClick={() => void confirmDeleteNode()}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function OrgSummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-3">
      <div className="text-11 font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-16 font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

// 제목 헤더(하단 보더) + 본문 패딩을 가진 카드 — 레거시 Card(title) 대체.
function TitledCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="border-b border-border">
        <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
          <CardTitle className="text-15 leading-5.5 font-bold tracking-normal text-foreground">
            {title}
          </CardTitle>
        </CardHeader>
      </div>
      <CardContent className="p-4 md:p-5">{children}</CardContent>
    </Card>
  );
}
