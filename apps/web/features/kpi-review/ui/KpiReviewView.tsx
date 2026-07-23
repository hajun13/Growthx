'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useRuleSet } from '@/hooks/useRuleSets';
import { useUsers } from '@/hooks/useUsers';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { ApiError } from '@/lib/api';
import { EmptyState, ErrorState, Forbidden } from '@/components/States';
import { InfoBanner } from '@/components/InfoBanner';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { StatusBadge } from '@/components/StatusBadge';
import { EvaluationSubjectPanel } from '@/components/EvaluationSubjectPanel';
import { EvaluationDetailHeader } from '@/components/EvaluationDetailHeader';
import { canReview } from '@/lib/nav';
import { getPositionLabel, kpiCategoryLabel } from '@/lib/ui';
import type { Kpi, KpiStatus, KpiReview } from '@/lib/types';
import { useKpiReviewData, useApprovalChain } from '../hooks';
import { kpiReviewCommands } from '../api';
import {
  CheckText,
  KpiCard,
  KPI_ROW_GRID,
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

  // 순차 결재선(1차 팀장→2차 본부장→최종 그룹대표). 승인은 자기 단계 차례에만, 반려는 결재선 구성원 누구나.
  const { stages: chain } = useApprovalChain(activeUser);
  const isHr = user?.role === 'hr_admin';
  const myStageIdx = chain.findIndex((s) => s.userId === user?.id);
  const stageInfoFor = (k: Kpi) => {
    const total = chain.length;
    const inProgress = k.status === 'submitted' || k.status === 'approved';
    // 현재 단계에 배정된 결재자가 있는가(chain[stage] 존재). 없으면(빈 체인·계층 공백) HR 폴백 단계.
    const stageHasEvaluator = k.approvalStage < total;
    const iAmStageEvaluator = myStageIdx >= 0 && myStageIdx === k.approvalStage;
    return {
      total,
      current: k.approvalStage,
      // 승인은 **내 차례에만** 노출 — 앞 단계가 안 끝난 건에 상위 결재자 승인 버튼이 보이면
      // 혼란(사용자 피드백). hr_admin 은 배정 결재자가 없는 단계만 대리(BE evaluateApprovalGate
      // 와 동일 규칙) — 배정 결재자가 있으면 HR 이라도 승인 미노출(정상 결재선 가로채기 방지).
      myTurn: canApprove && inProgress && (iAmStageEvaluator || (isHr && !stageHasEvaluator)),
      // 반려·수정요청은 승인과 별개 규칙 — BE reject() 는 진행 중이면 결재선 구성원 누구나
      // (하위 승인 후 포함) + hr_admin 상시 허용한다. 승인 게이트(myTurn)에 묶으면 HR 이
      // 멈춘 결재를 되돌릴 수단이 사라진다(확정 건 되돌림은 별도 HR 전용 경로).
      canSendBack: canApprove && inProgress && (isHr || myStageIdx >= 0),
      // 내 단계는 이미 승인 완료(상위 단계 진행 중).
      myDone: !isHr && myStageIdx >= 0 && inProgress && k.approvalStage > myStageIdx,
      nextName: inProgress ? (chain[k.approvalStage]?.name ?? (total === 0 ? 'HR 관리자' : null)) : null,
      finalStep: total === 0 || k.approvalStage + 1 >= total,
    };
  };

  // 시안(image 5): 카테고리 필터 탭(전체(n)/카테고리별(n)) + 가중치 순 정렬.
  const [catFilter, setCatFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<'weight' | 'default'>('weight');
  const catChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const k of activeKpis) counts.set(k.category, (counts.get(k.category) ?? 0) + 1);
    return Array.from(counts.entries()).map(([cat, n]) => ({ cat, n }));
  }, [activeKpis]);
  const displayKpis = useMemo(() => {
    const list = catFilter === 'all' ? activeKpis : activeKpis.filter((k) => k.category === catFilter);
    return sortMode === 'weight' ? [...list].sort((a, b) => b.weight - a.weight) : list;
  }, [activeKpis, catFilter, sortMode]);

  /**
   * 항목별 접힘 상태: true = 접힘(collapsed), false = 펼침.
   * 전 항목 기본 접힘 — 등급 부여 기준은 행 클릭 또는 "모두 펼치기"로만 펼침(시안 image 5).
   */
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  // activeUser가 바뀔 때마다 전 항목 기본 접힘으로 초기화.
  useEffect(() => {
    const init: Record<string, boolean> = {};
    for (const k of activeKpis) init[k.id] = true;
    setCollapsedMap(init);
    // activeKpis 참조 변화(activeUser 전환 시)에만 반응하도록 activeUser로 의존성 제한
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser]);

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const allCollapsed = activeKpis.every((k) => collapsedMap[k.id] ?? true);
  const toggleAllCollapsed = useCallback(() => {
    setCollapsedMap(() => {
      const next: Record<string, boolean> = {};
      for (const k of activeKpis) next[k.id] = !allCollapsed;
      return next;
    });
  }, [activeKpis, allCollapsed]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [acting, setActing] = useState<{ kpiId: string; mode: 'reject' | 'revision' } | null>(null);
  const [reason, setReason] = useState('');
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

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
      const updated = await kpiReviewCommands.approve(k.id);
      toast.show({
        variant: 'success',
        message:
          updated.status === 'confirmed'
            ? '최종 승인 — 전 단계 결재가 완료되어 확정했어요.'
            : `${k.approvalStage + 1}차 승인했어요. 다음 결재자(${chain[k.approvalStage + 1]?.name ?? '상위 결재자'})에게 넘어갔어요.`,
      });
      reloadAll();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '승인에 실패했어요.' });
    } finally { setBusyId(null); }
  }

  // 내 차례(승인 가능) 항목 일괄 승인 — 순차 approve 후 1회 reload.
  const myTurnKpis = activeKpis.filter((k) => stageInfoFor(k).myTurn);

  async function approveAllMyTurn() {
    if (!canApprove || myTurnKpis.length === 0) return;
    setBulkBusy(true);
    setBusyId('__bulk__');
    let okCount = 0;
    let failMsg: string | null = null;
    for (const k of myTurnKpis) {
      try {
        await kpiReviewCommands.approve(k.id);
        okCount++;
      } catch (err) {
        failMsg = err instanceof ApiError ? err.message : '승인에 실패했어요.';
        break; // 순차 결재 — 실패 지점에서 중단하고 나머지는 보존.
      }
    }
    setBusyId(null);
    setBulkBusy(false);
    setBulkConfirmOpen(false);
    toast.show(
      failMsg
        ? { variant: 'danger', message: `${okCount}건 승인 후 중단됐어요 — ${failMsg}` }
        : { variant: 'success', message: `내 차례 ${okCount}건을 모두 승인했어요.` },
    );
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
      accessory: <StatusBadge status={displayStatus} domain="kpi" />,
    };
  });

  return (
    <PageContainer>
      <PageHeader title="KPI 검토" subtitle="검토 대상자가 작성한 KPI 내용을 확인하고 승인/반려 처리합니다." />

      {userIds.length === 0 ? (
        <EmptyState title="검토할 KPI가 없어요." description="검토 대상자가 KPI를 제출하면 여기서 검토할 수 있어요." />
      ) : (
        <div className="gx-master-detail">

          <EvaluationSubjectPanel
            title="검토 대상"
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
              description={activeUser ? userPosition(activeUser) || 'KPI 검토 대상자' : '좌측에서 검토 대상을 선택하세요.'}
              metric={
                activeUser
                  ? { label: '제출 과제', value: activeKpis.length }
                  : undefined
              }
              className="border-x-0 border-t-0"
            />

            {activeKpis.length === 0 ? (
              <EmptyState
                title="선택한 검토 대상의 KPI가 없어요."
                description="검토 대상을 선택하면 KPI 목록을 검토할 수 있어요."
              />
            ) : (
              <div className="space-y-4 bg-muted/40 p-4">
                {/* 결재선 — 순차 승인 경로(승인은 자기 단계 차례에만, 반려는 결재선 구성원 누구나) */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 rounded-md bg-card border border-border/60 text-[12px]">
                  <span className="font-semibold text-muted-foreground">결재선</span>
                  {chain.length === 0 ? (
                    <span className="text-muted-foreground">지정된 결재선이 없어요 — HR 관리자가 결재해요.</span>
                  ) : (
                    chain.map((s, i) => (
                      <span key={s.userId} className="inline-flex items-center gap-2">
                        {i > 0 && <span className="text-muted-foreground/60" aria-hidden>→</span>}
                        <span className={s.userId === user?.id ? 'font-bold text-primary' : 'text-foreground'}>
                          {s.stage === chain.length ? '최종' : `${s.stage}차`} {s.name}
                          {s.position ? ` ${getPositionLabel(s.position)}` : ''}
                        </span>
                      </span>
                    ))
                  )}
                </div>

                {/* 검증 요약 + 일괄 승인 */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 rounded-md bg-muted border border-border/60">
                  <CheckText ok={weightTotal === 100}>가중치 {weightTotal}%</CheckText>
                  <CheckText ok={qualitativeTotal <= 30}>정성 {qualitativeTotal}%</CheckText>
                  <CheckText ok={hasCore}>성과중심 {hasCore ? '✓' : '미충족'}</CheckText>
                  <CheckText ok={hasGrowth}>협업·성장 {hasGrowth ? '✓' : '미충족'}</CheckText>
                  {myTurnKpis.length > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="ml-auto"
                      disabled={busyId !== null}
                      onClick={() => setBulkConfirmOpen(true)}
                    >
                      내 차례 {myTurnKpis.length}건 일괄 승인
                    </Button>
                  )}
                </div>

                {/* 카테고리 필터 탭 + 정렬 (시안 image 5) */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCatFilter('all')}
                    className={[
                      'rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition',
                      catFilter === 'all' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:bg-muted/60',
                    ].join(' ')}
                  >
                    전체 ({activeKpis.length})
                  </button>
                  {catChips.map(({ cat, n }) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCatFilter(cat)}
                      className={[
                        'rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition',
                        catFilter === cat ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:bg-muted/60',
                      ].join(' ')}
                    >
                      {kpiCategoryLabel[cat as keyof typeof kpiCategoryLabel] ?? cat} ({n})
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={toggleAllCollapsed}
                    className="ml-auto rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-semibold text-muted-foreground transition hover:bg-muted/60"
                  >
                    {allCollapsed ? '모두 펼치기' : '모두 접기'}
                  </button>
                  <select
                    aria-label="정렬 기준"
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as 'weight' | 'default')}
                    className="h-8 rounded-md border border-border bg-card px-2 text-[12px] text-foreground"
                  >
                    <option value="weight">가중치 순</option>
                    <option value="default">등록 순</option>
                  </select>
                </div>

                {/* 상태 안내 */}
                {activePending === 0 ? (
                  activeConfirmed.length > 0
                    ? <InfoBanner tone="success">검토·확정이 완료된 과제예요.</InfoBanner>
                    : <InfoBanner tone="info">검토 대상자가 KPI를 제출하면 문항별로 승인·반려·수정요청을 처리할 수 있어요.</InfoBanner>
                ) : !canApprove ? (
                  <InfoBanner tone="warning">KPI 승인/반려 권한이 없어요. 관리자에게 문의하세요.</InfoBanner>
                ) : null}

                {/* 컬럼 헤더 (시안 image 5 표형 구조 — 행 그리드와 동일 템플릿, 투명 보더로 행 카드의 1px 보더와 정렬) */}
                <div className={`${KPI_ROW_GRID} rounded-md border border-transparent bg-muted px-4 py-2 text-[11.5px] font-semibold text-muted-foreground`}>
                  <span>No.</span>
                  <span>KPI 항목</span>
                  <span>가중치</span>
                  <span className="text-right pr-7">검토</span>
                </div>

                {/* KPI 행 목록 — 행 클릭 시 등급 부여 기준 펼침 */}
                {displayKpis.map((k, index) => (
                  <KpiCard
                    key={k.id}
                    index={index + 1}
                    kpi={k}
                    reviews={reviewsByKpi.get(k.id) ?? []}
                    scales={ruleSet?.gradingScales}
                    busyId={busyId}
                    stage={stageInfoFor(k)}
                    collapsed={collapsedMap[k.id] ?? true}
                    onToggle={() => toggleCollapsed(k.id)}
                    onApprove={approveItem}
                    onOpenReject={openReject}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 일괄 승인 확인 모달 */}
      <Modal
        open={bulkConfirmOpen}
        onClose={() => { if (!bulkBusy) setBulkConfirmOpen(false); }}
        title="내 차례 항목을 일괄 승인할까요?"
        primaryAction={{
          label: `${myTurnKpis.length}건 일괄 승인`,
          variant: 'primary',
          loading: bulkBusy,
          onClick: () => void approveAllMyTurn(),
        }}
        secondaryAction={{ label: '취소', onClick: () => setBulkConfirmOpen(false) }}
        size="sm"
      >
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          지금 내 승인 차례인 <b className="text-foreground">{myTurnKpis.length}건</b>을 순서대로 승인해요.
          마지막 단계 항목은 곧바로 확정되고, 반려·수정요청이 필요한 항목이 있다면 취소 후 개별 처리해 주세요.
        </p>
      </Modal>

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
