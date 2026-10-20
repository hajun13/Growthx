'use client';

// KPI 확정 해제(hr_admin) — 전 단계 결재가 끝난 KPI 를 '작성중'으로 되돌려 구성원이 수정·재제출하게 한다.
import { Suspense, useMemo, useState } from 'react';
import { LockOpen, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCycleParam } from '@/hooks/useCycleParam';
import { ApiError } from '@/lib/api';
import { isHrAdmin } from '@/lib/nav';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { InfoBanner } from '@/components/InfoBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,
} from '@/components/ui/input-group';
import { kpiUnlockCommands, useUnlockOverview } from '../hooks';
import type { UnlockUser } from '../api';
import { EmptyState, ErrorState, Forbidden } from './StateViews';
import { UnlockDialog } from './UnlockDialog';
import { UnlockTable } from './UnlockTable';

// useCycleParam 이 useSearchParams 를 쓰므로 Suspense 경계 필수(정적 빌드 CSR bailout 방지).
export function KpiUnlockView() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <KpiUnlockViewInner />
    </Suspense>
  );
}

function KpiUnlockViewInner() {
  const { user } = useAuth();
  const { hasFeature, loading: permLoading } = usePermissions();
  const isAdminUser = !!user && isHrAdmin(user.role);
  const allowed = isAdminUser && hasFeature('KPI 승인/반려');
  const { cycles, current, selectedId, setSelectedId, loading: cyclesLoading } = useCycleParam();
  const { data, loading, error, reload } = useUnlockOverview(current?.id, { enabled: allowed });

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const users = useMemo(() => data?.users ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return users;
    return users.filter((u) => `${u.name} ${u.departmentName ?? ''} ${u.positionLabel ?? ''}`.includes(q));
  }, [users, search]);

  // 선택은 현재 목록에 있는 KPI 만 유효(주기 전환·재조회 후 잔존 선택 무시).
  const allKpis = useMemo(() => users.flatMap((u) => u.kpis), [users]);
  const pickedKpis = allKpis.filter((k) => selected.has(k.id));
  const pickedUsers = users.filter((u) => u.kpis.some((k) => selected.has(k.id))).length;
  const closed = data?.cycleStatus === 'closed';

  const toggle = (set: Set<string>, ids: string[], on: boolean) => {
    const next = new Set(set);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    return next;
  };
  const onToggleKpi = (id: string) => setSelected((s) => toggle(s, [id], !s.has(id)));
  const onToggleUser = (u: UnlockUser) =>
    setSelected((s) => toggle(s, u.kpis.map((k) => k.id), !u.kpis.every((k) => s.has(k.id))));
  const onToggleExpand = (userId: string) => setExpanded((s) => toggle(s, [userId], !s.has(userId)));
  const filteredIds = filtered.flatMap((u) => u.kpis.map((k) => k.id));
  const allFilteredPicked = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  async function confirmUnlock() {
    if (!reason.trim() || pickedKpis.length === 0) return;
    setBusy(true);
    try {
      const res = await kpiUnlockCommands.unlock(pickedKpis.map((k) => k.id), reason.trim());
      toast.success(`구성원 ${res.userCount}명의 KPI ${res.unlocked}건 확정을 해제했어요.`);
      setDialogOpen(false);
      setReason('');
      setSelected(new Set());
      void reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '확정 해제에 실패했어요.', { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }

  if (isAdminUser && permLoading) return <Skeleton className="h-64 w-full" />;
  if (!allowed) return <Forbidden message="KPI 확정 해제는 HR 관리자만 할 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="평가 주기가 없어요." />;

  return (
    <PageContainer>
      <PageHeader
        title="KPI 확정 해제"
        subtitle="전 단계 결재가 끝나 확정된 KPI를 '작성중'으로 되돌려요. 구성원이 수정해 다시 제출하면 결재선 1차부터 다시 결재해요."
        cycles={cycles.length > 1 ? cycles : undefined}
        selectedId={selectedId}
        onSelectCycle={(id) => { setSelectedId(id); setSelected(new Set()); }}
        right={
          <HeaderMetrics
            items={[
              { label: '확정 구성원', value: users.length },
              { label: '확정 KPI', value: allKpis.length },
              { label: '선택', value: pickedKpis.length, accent: pickedKpis.length > 0 ? 'text-primary' : undefined },
            ]}
          />
        }
      />

      {closed && (
        <InfoBanner tone="info" title="마감된 평가 주기예요">
          마감된 주기의 KPI는 결과가 확정돼 있어 확정을 해제할 수 없어요.
        </InfoBanner>
      )}
      {!closed && data?.kpiLocked && (
        <InfoBanner tone="warning" title="지금은 KPI 작성 기간이 잠겨 있어요">
          확정을 해제해도 구성원이 KPI를 수정할 수 없어요. 평가 운영에서 KPI 작성 단계 잠금을 먼저 풀어 주세요.
        </InfoBanner>
      )}

      <div className="gx-toolbar">
        <InputGroup className="inline-flex h-9 w-full min-w-50 md:w-64">
          <InputGroupAddon align="inline-start">
            <Search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            role="searchbox"
            aria-label="이름·소속 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름·소속 검색"
            className="h-full"
          />
          {search && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton variant="secondary" size="icon-xs" aria-label="검색어 지우기" onClick={() => setSearch('')}>
                <X aria-hidden />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <Button
          variant="outline"
          size="sm"
          disabled={closed || filteredIds.length === 0}
          onClick={() => setSelected((s) => toggle(s, filteredIds, !allFilteredPicked))}
        >
          {allFilteredPicked ? '목록 선택 해제' : '목록 전체 선택'}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {pickedKpis.length > 0 && (
            <span className="text-12 font-semibold text-muted-foreground">
              {pickedUsers}명 · {pickedKpis.length}건 선택
            </span>
          )}
          <Button size="sm" disabled={closed || pickedKpis.length === 0} onClick={() => setDialogOpen(true)}>
            <LockOpen aria-hidden />
            확정 해제
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          {loading && !data ? (
            <Skeleton className="h-60 w-full" />
          ) : error ? (
            <ErrorState onRetry={() => void reload()} />
          ) : users.length === 0 ? (
            <EmptyState title="확정된 KPI가 없어요." description="전 단계 결재를 마친 KPI가 이 주기에 아직 없어요." />
          ) : filtered.length === 0 ? (
            <EmptyState title="검색 결과가 없어요." />
          ) : (
            <UnlockTable
              users={filtered}
              selected={selected}
              expanded={expanded}
              disabled={closed}
              onToggleKpi={onToggleKpi}
              onToggleUser={onToggleUser}
              onToggleExpand={onToggleExpand}
            />
          )}
        </CardContent>
      </Card>

      <UnlockDialog
        open={dialogOpen}
        userCount={pickedUsers}
        kpiCount={pickedKpis.length}
        scoredCount={pickedKpis.filter((k) => k.scoreCount > 0).length}
        kpiLocked={!!data?.kpiLocked}
        reason={reason}
        busy={busy}
        onReasonChange={setReason}
        onConfirm={() => void confirmUnlock()}
        onClose={() => setDialogOpen(false)}
      />
    </PageContainer>
  );
}
