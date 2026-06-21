'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useRuleSet } from '@/hooks/useRuleSets';
import { useUsers } from '@/hooks/useUsers';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { EmptyState, ErrorState, Forbidden } from '@/components/States';
import { InfoBanner } from '@/components/InfoBanner';
import { Button } from '@/components/Button';
import { SearchInput } from '@/components/SearchInput';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { StatusBadge } from '@/components/StatusBadge';
import { canReview } from '@/lib/nav';
import { getPositionLabel } from '@/lib/ui';
import type { Kpi, KpiStatus, KpiReview } from '@/lib/types';
import { useKpiReviewData } from '../hooks';
import { kpiReviewCommands } from '../api';
import {
  CheckText,
  KpiCard,
  RejectModal,
  ReviewSkeleton,
} from './KpiReviewSubComponents';

export function KpiReviewView() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;
  const { hasFeature } = usePermissions();
  const { data: ruleSet } = useRuleSet(current?.ruleSetId ?? null);

  const allowed = !!user && canReview(user.role);
  const canApprove = hasFeature('KPI 승인/반려');

  const { kpis: allKpis, reviews, loading, loaded, error, reload: reloadAll } =
    useKpiReviewData(cycleId, !!cycleId && allowed);

  const reviewsByKpi = useMemo(() => {
    const map = new Map<string, KpiReview[]>();
    for (const r of reviews) {
      const arr = map.get(r.kpiId) ?? [];
      arr.push(r);
      map.set(r.kpiId, arr);
    }
    return map;
  }, [reviews]);

  const { data: usersData } = useUsers({ pageSize: 500 }, { enabled: allowed });
  const userInfo = useMemo(() => {
    const map = new Map<string, { name: string; position: string }>();
    for (const u of usersData?.data ?? []) {
      map.set(u.id, { name: u.name, position: getPositionLabel(u.position) });
    }
    return map;
  }, [usersData]);
  const userName = (uid: string) => userInfo.get(uid)?.name ?? uid.slice(0, 8);
  const userPosition = (uid: string) => userInfo.get(uid)?.position ?? '';

  const kpis = allKpis.filter((k) => k.userId !== user?.id);

  const byUser = useMemo(() => {
    const map = new Map<string, Kpi[]>();
    for (const k of kpis) {
      const arr = map.get(k.userId) ?? [];
      arr.push(k);
      map.set(k.userId, arr);
    }
    return map;
  }, [kpis]);

  const userIds = Array.from(byUser.keys());
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const activeUser = selectedUser ?? userIds[0] ?? null;
  const activeKpis = activeUser ? (byUser.get(activeUser) ?? []) : [];

  /**
   * 항목별 접힘 상태: true = 접힘(collapsed), false = 펼침.
   * - approved / confirmed → 기본 접힘(true)
   * - 그 외(submitted, draft 등 처리 대기) → 기본 펼침(false)
   */
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  // activeUser가 바뀔 때마다 해당 사용자의 KPI 항목 기본 접힘 상태로 초기화
  useEffect(() => {
    const init: Record<string, boolean> = {};
    for (const k of activeKpis) {
      init[k.id] = k.status === 'approved' || k.status === 'confirmed';
    }
    setCollapsedMap(init);
    // activeKpis 참조 변화(activeUser 전환 시)에만 반응하도록 activeUser로 의존성 제한
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser]);

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [acting, setActing] = useState<{ kpiId: string; mode: 'reject' | 'revision' } | null>(null);
  const [reason, setReason] = useState('');
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);

  const selectUser = (uid: string) => { setSelectedUser(uid); setActing(null); setReason(''); };
  const openReject  = (kpiId: string, mode: 'reject' | 'revision') => { setActing({ kpiId, mode }); setReason(''); };
  const closeReject = () => { setActing(null); setReason(''); };

  const activeSubmitted = activeKpis.filter((k) => k.status === 'submitted');
  const activeApproved  = activeKpis.filter((k) => k.status === 'approved');
  const activePending   = activeSubmitted.length + activeApproved.length;
  const activeConfirmed = activeKpis.filter((k) => k.status === 'confirmed');
  const weightTotal      = activeKpis.reduce((acc, k) => acc + k.weight, 0);
  const qualitativeTotal = activeKpis.filter((k) => k.isQualitative).reduce((acc, k) => acc + k.weight, 0);
  const hasCore   = activeKpis.some((k) => k.group === 'performance_core');
  const hasGrowth = activeKpis.some((k) => k.group === 'collaboration_growth');

  async function approveItem(k: Kpi) {
    if (!canApprove) return;
    setBusyId(k.id);
    try {
      await kpiReviewCommands.approve(k.id);
      await kpiReviewCommands.confirm(k.id);
      toast.show({ variant: 'success', message: '승인·확정했어요.' });
      reloadAll();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '승인에 실패했어요.' });
    } finally { setBusyId(null); }
  }

  async function confirmItem(k: Kpi) {
    if (!canApprove) return;
    setBusyId(k.id);
    try {
      await kpiReviewCommands.confirm(k.id);
      toast.show({ variant: 'success', message: '확정했어요.' });
      reloadAll();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '확정에 실패했어요.' });
    } finally { setBusyId(null); }
  }

  async function batchApprove() {
    if (!canApprove || activeSubmitted.length === 0) return;
    setBatchBusy(true);
    setBatchConfirmOpen(false);
    let ok = 0; let fail = 0;
    for (const k of activeSubmitted) {
      try { await kpiReviewCommands.approve(k.id); await kpiReviewCommands.confirm(k.id); ok++; }
      catch { fail++; }
    }
    if (ok > 0) toast.show({ variant: 'success', message: `${ok}개 과제를 승인·확정했어요.` });
    if (fail > 0) toast.show({ variant: 'danger', message: `${fail}개 과제는 처리에 실패했어요.` });
    setBatchBusy(false);
    reloadAll();
  }

  async function submitReject() {
    if (!acting || !canApprove) return;
    const trimmed = reason.trim();
    if (!trimmed) return;
    setBusyId(acting.kpiId);
    try {
      const r = acting.mode === 'revision' ? `[수정요청] ${trimmed}` : trimmed;
      await kpiReviewCommands.reject(acting.kpiId, r, trimmed);
      toast.show({ variant: 'success', message: acting.mode === 'reject' ? '반려했어요.' : '수정요청했어요.' });
      closeReject();
      reloadAll();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '처리에 실패했어요.' });
    } finally { setBusyId(null); }
  }

  if (!allowed) return <Forbidden message="KPI 검토는 팀장 이상만 접근할 수 있어요." />;
  if (cyclesLoading || (loading && !loaded)) return <ReviewSkeleton />;
  if (error) return <ErrorState onRetry={reloadAll} />;

  const filteredUserIds = userIds.filter((uid) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return userName(uid).toLowerCase().includes(q) || userPosition(uid).toLowerCase().includes(q);
  });

  return (
    <PageContainer>
      <PageHeader title="KPI 검토" subtitle="팀원의 KPI 작성 내용을 검토하고 승인/반려 처리합니다." />

      {userIds.length === 0 ? (
        <EmptyState title="검토할 KPI가 없어요." description="팀원이 KPI를 제출하면 여기서 검토할 수 있어요." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr] items-start">

          {/* 팀원 목록 */}
          <div className="rounded-none overflow-hidden border border-border bg-card">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted">
              <span className="text-[12px] font-bold text-foreground">팀원</span>
              <div className="ml-auto">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="검색"
                  className="w-36"
                />
              </div>
            </div>
            <ul>
              {filteredUserIds.length === 0 ? (
                <li className="py-6 text-center text-[12.5px] text-muted-foreground">결과 없음</li>
              ) : filteredUserIds.map((uid) => {
                const list = byUser.get(uid) ?? [];
                const active = uid === activeUser;
                const hasSub = list.some((k) => k.status === 'submitted');
                const allConfirmed = list.every((k) => k.status === 'confirmed');
                const displayStatus: KpiStatus = hasSub ? 'submitted' : allConfirmed ? 'confirmed' : (list[0]?.status ?? 'draft');
                return (
                  <li key={uid}>
                    <button
                      type="button"
                      onClick={() => selectUser(uid)}
                      className={[
                        'flex w-full items-center gap-2.5 px-4 py-3 border-b border-border last:border-b-0 text-left transition-colors',
                        active ? 'bg-accent' : 'hover:bg-muted/60',
                      ].join(' ')}
                    >
                      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-[12px] font-bold">
                        {userName(uid).slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-[13px] font-semibold text-foreground">
                          {userName(uid)}
                          {userPosition(uid) && (
                            <span className="text-[11px] font-normal text-muted-foreground ml-1.5">
                              {userPosition(uid)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{list.length}개 과제</div>
                      </div>
                      <StatusBadge status={displayStatus} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 검토 상세 */}
          <div className="rounded-none overflow-hidden border border-border bg-card">
            {/* 패널 헤더 */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted">
              <span className="text-[12px] font-bold text-foreground">
                {activeUser ? userName(activeUser) : '검토 상세'}
              </span>
              {activeUser && userPosition(activeUser) && (
                <span className="text-[11px] text-muted-foreground">{userPosition(activeUser)}</span>
              )}
              {canApprove && activeSubmitted.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={batchBusy}
                  loading={batchBusy}
                  leftIcon={<CheckCheck size={12} aria-hidden />}
                  className="ml-auto text-[11.5px]"
                  onClick={() => setBatchConfirmOpen(true)}
                >
                  일괄 승인 ({activeSubmitted.length}개)
                </Button>
              )}
            </div>

            {activeKpis.length === 0 ? (
              <EmptyState
                title="선택한 팀원의 KPI가 없어요."
                description="팀원을 선택하면 KPI 목록을 검토할 수 있어요."
              />
            ) : (
              <div className="p-3.5 space-y-3">
                {/* 검증 요약 */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 rounded-none bg-muted border border-border/60">
                  <CheckText ok={weightTotal === 100}>가중치 {weightTotal}%</CheckText>
                  <CheckText ok={qualitativeTotal <= 30}>정성 {qualitativeTotal}%</CheckText>
                  <CheckText ok={hasCore}>성과중심 {hasCore ? '✓' : '미충족'}</CheckText>
                  <CheckText ok={hasGrowth}>협업·성장 {hasGrowth ? '✓' : '미충족'}</CheckText>
                </div>

                {/* 상태 안내 */}
                {activePending === 0 ? (
                  activeConfirmed.length > 0
                    ? <InfoBanner tone="success">검토·확정이 완료된 과제예요.</InfoBanner>
                    : <InfoBanner tone="info">팀원이 KPI를 제출하면 문항별로 승인·반려·수정요청을 처리할 수 있어요.</InfoBanner>
                ) : !canApprove ? (
                  <InfoBanner tone="warning">KPI 승인/반려 권한이 없어요. 관리자에게 문의하세요.</InfoBanner>
                ) : null}

                {/* KPI 카드 목록 */}
                {activeKpis.map((k) => (
                  <KpiCard
                    key={k.id}
                    kpi={k}
                    reviews={reviewsByKpi.get(k.id) ?? []}
                    scales={ruleSet?.gradingScales}
                    busyId={busyId}
                    batchBusy={batchBusy}
                    canApprove={canApprove}
                    collapsed={collapsedMap[k.id] ?? (k.status === 'approved' || k.status === 'confirmed')}
                    onToggle={() => toggleCollapsed(k.id)}
                    onApprove={approveItem}
                    onConfirm={confirmItem}
                    onOpenReject={openReject}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 반려/수정요청 모달 */}
      <RejectModal
        open={acting !== null}
        mode={acting?.mode ?? null}
        reason={reason}
        busy={busyId !== null}
        onChange={setReason}
        onSubmit={() => void submitReject()}
        onClose={closeReject}
      />

      {/* 일괄 승인 확인 모달 */}
      <Modal
        open={batchConfirmOpen}
        onClose={() => setBatchConfirmOpen(false)}
        title={`${activeSubmitted.length}개 과제를 일괄 승인할까요?`}
        primaryAction={{ label: '일괄 승인', variant: 'primary', loading: batchBusy, onClick: () => void batchApprove() }}
        secondaryAction={{ label: '취소', onClick: () => setBatchConfirmOpen(false) }}
        size="sm"
      >
        <p className="text-[13px] text-muted-foreground">
          {activeUser && (
            <><strong className="text-foreground">{userName(activeUser)}</strong>님의 제출된 과제 {activeSubmitted.length}개를 모두 승인·확정해요.</>
          )}
        </p>
      </Modal>
    </PageContainer>
  );
}
