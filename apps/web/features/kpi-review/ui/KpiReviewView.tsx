'use client';

import { useMemo, useState } from 'react';
import { Check, X, MessageSquare, Search, ClipboardCheck, AlertCircle, Users, CheckCheck, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useRuleSet } from '@/hooks/useRuleSets';
import { useUsers } from '@/hooks/useUsers';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { kpiGroupLabel, kpiCategoryLabel, measureTypeUnit } from '@/lib/ui';
import { canReview } from '@/lib/nav';
import { getPositionLabel } from '@/lib/ui';
import { categoryChip } from '@/lib/toss';
import { KpiGradingDisplay } from '@/components/KpiGradingDisplay';
import type { Kpi, KpiReview, KpiStatus } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { InfoBanner } from '@/components/InfoBanner';
import { useKpiReviewData } from '../hooks';
import { kpiReviewCommands } from '../api';

const K = {
  primary:          '#7a37d8',
  primaryContainer: '#6a2dc0',
  secondary:        '#7A37D8',
  tertiary:         '#2563eb',
  surface:          '#f7f7f9',
  surfaceLow:       '#efeff2',
  white:            '#ffffff',
  onSurface:        '#18181c',
  onSurfaceVariant: '#565660',
  grey:             '#74747f',
  outline:          '#ccccd4',
  divider:          '#efeff2',
} as const;

const STATUS_CFG: Record<KpiStatus, { bg: string; label: string }> = {
  draft:              { bg: '#74747f', label: '작성중'   },
  submitted:          { bg: '#f59e0b', label: '검토 대기' },
  approved:           { bg: '#2563eb', label: '승인'     },
  confirmed:          { bg: K.primary, label: '확정'     },
  rejected:           { bg: '#e5484d', label: '반려'     },
  revision_requested: { bg: '#a0282d', label: '수정요청' },
};

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
  const submitted = kpis.filter((k) => k.status === 'submitted');

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

  const processedCount = kpis.filter((k) => k.status === 'confirmed' || k.status === 'approved').length;
  const totalKpiCount  = kpis.length;
  const progressPct    = totalKpiCount > 0 ? Math.round((processedCount / totalKpiCount) * 100) : 0;

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

  const summary = {
    total:    userIds.length,
    waiting:  submitted.length,
    approved: kpis.filter((k) => k.status === 'approved' || k.status === 'confirmed').length,
    rejected: kpis.filter((k) => k.status === 'rejected' || k.status === 'revision_requested').length,
  };

  return (
    <PageContainer>
      <PageHeader title="KPI 검토" subtitle="팀원의 KPI 작성 내용을 검토하고 승인/반려 처리합니다." />

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: '검토 대상자',     value: summary.total,    color: K.primary,   Icon: Users        },
          { label: '검토 대기(과제)', value: summary.waiting,  color: '#f59e0b',   Icon: AlertCircle  },
          { label: '승인·확정(과제)', value: summary.approved, color: K.tertiary,  Icon: CheckCircle2 },
          { label: '반려·수정(과제)', value: summary.rejected, color: '#e5484d',   Icon: XCircle      },
        ] as const).map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-[#ccccd4]/50"
          >
            <s.Icon size={20} color={s.color} style={{ opacity: 0.8, flexShrink: 0 }} />
            <div>
              <div className="tabular-nums font-extrabold leading-tight" style={{ fontSize: 26, color: s.color }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11, color: K.grey, fontWeight: 500, marginTop: 1 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 진행률 */}
      {totalKpiCount > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white border border-[#ccccd4]/50">
          <ClipboardCheck size={14} color={K.secondary} style={{ flexShrink: 0 }} />
          <div className="flex-1">
            <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: K.surfaceLow }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: progressPct === 100 ? K.tertiary : K.secondary,
                }}
              />
            </div>
          </div>
          <span className="tabular-nums flex-shrink-0" style={{ fontSize: 12, fontWeight: 600, color: K.secondary }}>
            {processedCount}/{totalKpiCount}개 ({progressPct}%)
          </span>
          {submitted.length > 0 && (
            <span style={{ fontSize: 11.5, color: '#f59e0b', flexShrink: 0 }}>
              대기 {submitted.length}개
            </span>
          )}
        </div>
      )}

      {userIds.length === 0 ? (
        <EmptyState title="검토할 KPI가 없어요." description="팀원이 KPI를 제출하면 여기서 검토할 수 있어요." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]" style={{ alignItems: 'start' }}>

          {/* 팀원 목록 */}
          <div className="rounded-xl overflow-hidden border border-[#ccccd4]/50 bg-white">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#efeff2]" style={{ background: K.surfaceLow }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: K.onSurface }}>팀원</span>
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 ml-auto"
                style={{ border: `1px solid ${K.outline}`, borderRadius: 999, background: K.white }}
              >
                <Search size={11} color={K.grey} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="검색"
                  className="outline-none"
                  style={{ fontSize: 11.5, background: 'transparent', color: K.onSurface, width: 70 }}
                />
              </div>
            </div>
            <ul>
              {filteredUserIds.length === 0 ? (
                <li className="py-6 text-center" style={{ fontSize: 12.5, color: K.grey }}>결과 없음</li>
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
                      className="flex w-full items-center gap-2.5 px-4 py-3 border-b last:border-b-0 text-left"
                      style={{
                        borderColor: K.divider,
                        background: active ? 'rgba(122,55,216,0.06)' : 'transparent',
                        borderLeft: active ? `3px solid ${K.primary}` : '3px solid transparent',
                      }}
                    >
                      <div
                        className="flex-shrink-0 flex items-center justify-center"
                        style={{ width: 30, height: 30, borderRadius: '50%', background: K.primaryContainer, fontSize: 12, fontWeight: 700, color: '#fff' }}
                      >
                        {userName(uid).slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: K.onSurface }}>
                          {userName(uid)}
                          {userPosition(uid) && (
                            <span style={{ fontSize: 11, fontWeight: 400, color: K.grey, marginLeft: 5 }}>
                              {userPosition(uid)}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: K.grey }}>{list.length}개 과제</div>
                      </div>
                      <StatusBadge status={displayStatus} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 검토 상세 */}
          <div className="rounded-xl overflow-hidden border border-[#ccccd4]/50 bg-white">
            {/* 패널 헤더 */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 border-b border-[#efeff2]"
              style={{ background: K.surfaceLow }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: K.onSurface }}>
                {activeUser ? userName(activeUser) : '검토 상세'}
              </span>
              {activeUser && userPosition(activeUser) && (
                <span style={{ fontSize: 11, color: K.grey }}>{userPosition(activeUser)}</span>
              )}
              {canApprove && activeSubmitted.length > 0 && (
                <button
                  onClick={() => setBatchConfirmOpen(true)}
                  disabled={batchBusy}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-white disabled:opacity-50"
                  style={{ fontSize: 11.5, fontWeight: 600, background: K.secondary, borderRadius: 6 }}
                >
                  <CheckCheck size={12} />
                  {batchBusy ? '처리 중…' : `일괄 승인 (${activeSubmitted.length}개)`}
                </button>
              )}
            </div>

            {activeKpis.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2">
                <ClipboardCheck size={28} color="#ccccd4" />
                <p style={{ fontSize: 13, color: K.grey }}>선택한 팀원의 KPI가 없어요.</p>
              </div>
            ) : (
              <div style={{ padding: '14px 16px' }} className="space-y-3">

                {/* 검증 요약 — 한 줄 */}
                <div
                  className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 rounded-lg"
                  style={{ fontSize: 12, background: K.surfaceLow, border: `1px solid rgba(204,204,212,0.4)` }}
                >
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
                {activeKpis.map((k) => {
                  const cc = categoryChip[k.category] ?? categoryChip.orders;
                  const isBusy = busyId === k.id;
                  const hasTarget = k.targetText || k.targetValue !== null;
                  const hasInfo = hasTarget || !!k.measureMethod;
                  const kpiReviews = reviewsByKpi.get(k.id) ?? [];
                  const rejectReason = k.status === 'draft' ? k.rejectReason : null;
                  const hasReviewHistory = kpiReviews.length > 0 || !!rejectReason;
                  const canAct = canApprove && (k.status === 'submitted' || k.status === 'approved');

                  return (
                    <div
                      key={k.id}
                      className="rounded-xl overflow-hidden"
                      style={{ border: `1px solid ${K.divider}` }}
                    >
                      {/* ─ 카드 헤더 ─ */}
                      <div style={{ padding: '12px 16px 10px' }}>
                        {/* 메타 행 */}
                        <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 7 }}>
                          <span
                            style={{ fontSize: 10.5, fontWeight: 600, background: cc.bg, color: cc.color, borderRadius: 4, padding: '1px 6px' }}
                          >
                            {kpiCategoryLabel[k.category]}
                          </span>
                          <span style={{ fontSize: 10.5, color: K.grey, background: K.surfaceLow, borderRadius: 4, padding: '1px 6px' }}>
                            {kpiGroupLabel[k.group]}
                          </span>
                          <span
                            style={{
                              fontSize: 10.5, fontWeight: 600, borderRadius: 3, padding: '1px 5px',
                              background: k.isQualitative ? 'rgba(122,55,216,0.09)' : 'rgba(122,55,216,0.08)',
                              color: k.isQualitative ? K.primary : K.secondary,
                            }}
                          >
                            {k.isQualitative ? '정성' : '정량'}
                          </span>
                          <div className="ml-auto flex items-center gap-1.5">
                            <span
                              className="tabular-nums"
                              style={{ fontSize: 11.5, fontWeight: 700, color: K.primary, background: 'rgba(122,55,216,0.07)', borderRadius: 5, padding: '2px 8px' }}
                            >
                              {k.weight}%
                            </span>
                            <StatusBadge status={k.status} />
                          </div>
                        </div>
                        {/* 제목 */}
                        <div style={{ fontSize: 14, fontWeight: 700, color: K.onSurface, lineHeight: 1.45 }}>
                          {k.title}
                        </div>
                      </div>

                      {/* ─ 목표 · 측정방식 ─ */}
                      {hasInfo && (
                        <div style={{ borderTop: `1px solid ${K.divider}`, padding: '8px 16px', background: '#f7f7f9' }}>
                          <dl style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '3px 10px', margin: 0 }}>
                            {hasTarget && (
                              <>
                                <dt style={{ fontSize: 10.5, fontWeight: 700, color: K.grey, paddingTop: 2, margin: 0 }}>목표</dt>
                                <dd style={{ fontSize: 12.5, color: K.onSurface, margin: 0, lineHeight: 1.55 }}>
                                  {k.targetText ?? `${k.targetValue}${measureTypeUnit[k.measureType]}`}
                                </dd>
                              </>
                            )}
                            {k.measureMethod && (
                              <>
                                <dt style={{ fontSize: 10.5, fontWeight: 700, color: K.grey, paddingTop: 2, margin: 0 }}>측정</dt>
                                <dd style={{ fontSize: 12.5, color: K.onSurface, margin: 0, lineHeight: 1.55 }}>{k.measureMethod}</dd>
                              </>
                            )}
                          </dl>
                        </div>
                      )}

                      {/* ─ 등급 기준 ─ */}
                      <div style={{ borderTop: `1px solid ${K.divider}`, padding: '8px 16px' }}>
                        <KpiGradingDisplay kpi={k} scales={ruleSet?.gradingScales} />
                      </div>

                      {/* ─ 검토 이력 ─ */}
                      {hasReviewHistory && (
                        <ReviewHistory reviews={kpiReviews} rejectReason={rejectReason} />
                      )}

                      {/* ─ 액션 바 ─ */}
                      {canAct && (
                        <div
                          className="flex items-center gap-2 px-4 py-2.5"
                          style={{ borderTop: `1px solid ${K.divider}`, background: K.surfaceLow }}
                        >
                          {k.status === 'submitted' ? (
                            <>
                              <button
                                onClick={() => openReject(k.id, 'reject')}
                                disabled={busyId !== null || batchBusy}
                                className="flex items-center gap-1 px-3 py-1.5 disabled:opacity-50"
                                style={{ fontSize: 12, fontWeight: 600, color: '#e5484d', background: 'rgba(186,26,26,0.07)', border: '1px solid rgba(186,26,26,0.18)', borderRadius: 6 }}
                              >
                                <X size={12} /> 반려
                              </button>
                              <button
                                onClick={() => openReject(k.id, 'revision')}
                                disabled={busyId !== null || batchBusy}
                                className="flex items-center gap-1 px-3 py-1.5 disabled:opacity-50"
                                style={{ fontSize: 12, fontWeight: 600, color: K.onSurfaceVariant, border: `1px solid ${K.outline}`, background: K.white, borderRadius: 6 }}
                              >
                                <MessageSquare size={12} /> 수정요청
                              </button>
                              <button
                                onClick={() => void approveItem(k)}
                                disabled={busyId !== null || batchBusy}
                                className="flex items-center gap-1 px-4 py-1.5 text-white disabled:opacity-50 ml-auto"
                                style={{ fontSize: 12, fontWeight: 600, background: K.secondary, borderRadius: 6 }}
                              >
                                <Check size={12} /> {isBusy ? '처리 중…' : '승인'}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => void confirmItem(k)}
                              disabled={busyId !== null || batchBusy}
                              className="flex items-center gap-1 px-4 py-1.5 text-white disabled:opacity-50 ml-auto"
                              style={{ fontSize: 12, fontWeight: 600, background: K.primary, borderRadius: 6 }}
                            >
                              <Check size={12} /> {isBusy ? '처리 중…' : '확정'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 반려/수정요청 모달 */}
      <Modal
        open={acting !== null}
        onClose={closeReject}
        title={acting?.mode === 'reject' ? '반려할까요?' : '수정요청할까요?'}
        primaryAction={{
          label: acting?.mode === 'reject' ? '반려' : '수정요청',
          variant: 'danger',
          loading: busyId !== null,
          disabled: reason.trim().length === 0,
          onClick: () => void submitReject(),
        }}
        secondaryAction={{ label: '취소', onClick: closeReject }}
      >
        <div className="space-y-3">
          <p style={{ fontSize: 13, color: K.onSurfaceVariant }}>
            {acting?.mode === 'reject'
              ? '반려하면 사유가 작성자에게 전달되고 해당 문항은 작성중으로 돌아가요.'
              : '수정요청하면 사유가 전달되고 작성자가 수정 후 재제출해야 해요.'}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
            placeholder={acting?.mode === 'reject' ? '반려 사유를 작성해 주세요.' : '수정 요청 사항을 작성해 주세요.'}
            className="w-full resize-none outline-none"
            style={{
              border: `1px solid ${K.outline}`, borderRadius: 8, padding: '10px 12px',
              fontSize: 13, color: K.onSurface, minHeight: 90, background: K.surfaceLow,
              transition: 'border-color .12s, box-shadow .12s',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = K.secondary; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(122,55,216,0.10)'; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = K.outline;    e.currentTarget.style.boxShadow = 'none'; }}
          />
          {reason.trim().length === 0 && (
            <p style={{ fontSize: 11, color: '#e5484d' }}>사유를 입력해야 처리할 수 있어요.</p>
          )}
        </div>
      </Modal>

      {/* 일괄 승인 확인 모달 */}
      <Modal
        open={batchConfirmOpen}
        onClose={() => setBatchConfirmOpen(false)}
        title={`${activeSubmitted.length}개 과제를 일괄 승인할까요?`}
        primaryAction={{ label: '일괄 승인', variant: 'primary' as const, loading: batchBusy, onClick: () => void batchApprove() }}
        secondaryAction={{ label: '취소', onClick: () => setBatchConfirmOpen(false) }}
        size="sm"
      >
        <p style={{ fontSize: 13, color: K.onSurfaceVariant }}>
          {activeUser && (
            <><strong style={{ color: K.onSurface }}>{userName(activeUser)}</strong>님의 제출된 과제 {activeSubmitted.length}개를 모두 승인·확정해요.</>
          )}
        </p>
      </Modal>
    </PageContainer>
  );
}

// ── 서브 컴포넌트 ───────────────────────────────────────────────

function ReviewHistory({ reviews, rejectReason }: { reviews: KpiReview[]; rejectReason: string | null }) {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div style={{ borderTop: `1px solid ${K.divider}`, padding: '8px 16px 10px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: K.grey, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <MessageSquare size={10} /> 검토 이력
      </div>
      <div className="space-y-1.5">
        {rejectReason && (
          <div style={{ padding: '7px 10px', borderRadius: 6, background: 'rgba(186,26,26,0.05)', border: '1px solid rgba(186,26,26,0.15)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#e5484d', marginBottom: 3 }}>반려 사유</div>
            <div style={{ fontSize: 12.5, color: K.onSurface, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{rejectReason}</div>
          </div>
        )}
        {reviews.map((r) => {
          const isImprovement = r.kind === 'improvement';
          const accent = isImprovement ? '#f59e0b' : K.tertiary;
          return (
            <div
              key={r.id}
              style={{
                padding: '7px 10px', borderRadius: 6,
                background: isImprovement ? 'rgba(245,120,0,0.05)' : 'rgba(14,154,160,0.05)',
                border: `1px solid ${isImprovement ? 'rgba(245,120,0,0.15)' : 'rgba(14,154,160,0.15)'}`,
              }}
            >
              <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>
                  {isImprovement ? '보완 의견' : '승인 의견'}
                </span>
                <span style={{ fontSize: 11, color: K.onSurfaceVariant }}>
                  {r.authorName}{r.authorPosition ? ` · ${r.authorPosition}` : ''}
                </span>
                <span className="ml-auto" style={{ fontSize: 10.5, color: K.grey }}>{fmt(r.createdAt)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: K.onSurface, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{r.content}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckText({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1" style={{ color: ok ? K.tertiary : K.grey }}>
      {ok ? <Check size={11} /> : <span style={{ width: 11, textAlign: 'center', fontSize: 10 }}>·</span>}
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: KpiStatus }) {
  const s = STATUS_CFG[status];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, background: s.bg, color: '#fff', borderRadius: 999, padding: '2px 8px' }}>
      {s.label}
    </span>
  );
}

function ReviewSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </PageContainer>
  );
}
