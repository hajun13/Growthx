'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useRuleSet } from '@/hooks/useRuleSets';
import { useUsers } from '@/hooks/useUsers';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { EmptyState, ErrorState, Forbidden } from '@/components/States';
import { InfoBanner } from '@/components/InfoBanner';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { StatusBadge } from '@/components/StatusBadge';
import { EvaluationSubjectPanel } from '@/components/EvaluationSubjectPanel';
import { EvaluationDetailHeader } from '@/components/EvaluationDetailHeader';
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
  const [acting, setActing] = useState<{ kpiId: string; mode: 'reject' | 'revision' } | null>(null);
  const [reason, setReason] = useState('');

  const selectUser = (uid: string) => { setSelectedUser(uid); setActing(null); setReason(''); };
  const openReject  = (kpiId: string, mode: 'reject' | 'revision') => { setActing({ kpiId, mode }); setReason(''); };
  const closeReject = () => { setActing(null); setReason(''); };

  const activeApproved  = activeKpis.filter((k) => k.status === 'approved');
  const activePending   = activeKpis.filter((k) => k.status === 'submitted').length + activeApproved.length;
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
  const subjectItems = filteredUserIds.map((uid) => {
    const list = byUser.get(uid) ?? [];
    const hasSub = list.some((k) => k.status === 'submitted');
    const allConfirmed = list.length > 0 && list.every((k) => k.status === 'confirmed');
    const displayStatus: KpiStatus = hasSub ? 'submitted' : allConfirmed ? 'confirmed' : (list[0]?.status ?? 'draft');
    return {
      id: uid,
      name: userName(uid),
      meta: userPosition(uid) || null,
      description: `${list.length}개 과제`,
      active: uid === activeUser,
      onSelect: () => selectUser(uid),
      accessory: <StatusBadge status={displayStatus} />,
    };
  });

  return (
    <PageContainer>
      <PageHeader title="KPI 검토" subtitle="팀원의 KPI 작성 내용을 검토하고 승인/반려 처리합니다." />

      {userIds.length === 0 ? (
        <EmptyState title="검토할 KPI가 없어요." description="팀원이 KPI를 제출하면 여기서 검토할 수 있어요." />
      ) : (
        <div className="gx-master-detail">

          <EvaluationSubjectPanel
            title="팀원"
            count={userIds.length}
            search={search}
            onSearch={setSearch}
            searchPlaceholder="검색"
            emptyMessage="검색 결과가 없어요."
            items={subjectItems}
          />

          {/* 검토 상세 */}
          <div className="gx-work-surface overflow-hidden">
            <EvaluationDetailHeader
              name={activeUser ? userName(activeUser) : '검토 상세'}
              description={activeUser ? userPosition(activeUser) || 'KPI 검토 대상자' : '좌측에서 팀원을 선택하세요.'}
              metric={
                activeUser
                  ? { label: '제출 과제', value: activeKpis.length }
                  : undefined
              }
              className="border-x-0 border-t-0"
            />

            {activeKpis.length === 0 ? (
              <EmptyState
                title="선택한 팀원의 KPI가 없어요."
                description="팀원을 선택하면 KPI 목록을 검토할 수 있어요."
              />
            ) : (
              <div className="space-y-4 bg-muted/40 p-4">
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
                {activeKpis.map((k, index) => (
                  <KpiCard
                    key={k.id}
                    index={index + 1}
                    kpi={k}
                    reviews={reviewsByKpi.get(k.id) ?? []}
                    scales={ruleSet?.gradingScales}
                    busyId={busyId}
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
    </PageContainer>
  );
}
