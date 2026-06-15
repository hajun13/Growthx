'use client';

import { useMemo, useState } from 'react';
import { Check, X, MessageSquare, Search, ClipboardCheck, AlertCircle, Users, CheckCheck, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useKpis, useKpiReviews, kpiCommands } from '@/hooks/useKpis';
import { useRuleSet } from '@/hooks/useRuleSets';
import { useUsers } from '@/hooks/useUsers';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import {
  kpiGroupLabel,
  kpiCategoryLabel,
  measureTypeUnit,
} from '@/lib/ui';
import { canReview } from '@/lib/nav';
import { getPositionLabel } from '@/lib/ui';
import { categoryChip } from '@/lib/toss';
import { KpiGradingDisplay } from '@/components/KpiGradingDisplay';
import type { Kpi, KpiReview, KpiStatus } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { InfoBanner } from '@/components/InfoBanner';

// ── Kinetic Enterprise 팔레트 ───────────────────────────────────
const K = {
  primary:          '#3f2c80',
  primaryContainer: '#564599',
  secondary:        '#0054ca',
  secondaryDim:     '#336fe5',
  tertiary:         '#0e9aa0',
  surface:          '#f8f9fd',
  surfaceLow:       '#f2f3f7',
  white:            '#ffffff',
  onSurface:        '#191c1f',
  onSurfaceVariant: '#484551',
  outline:          '#cac4d2',
  outlineDim:       'rgba(202,196,210,0.4)',
} as const;

const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

const card: React.CSSProperties = {
  background: K.white,
  border: '1px solid rgba(202,196,210,0.5)',
  borderRadius: 12,
  boxShadow: CARD_SHADOW,
};

const STATUS_CFG: Record<KpiStatus, { bg: string; label: string }> = {
  draft:              { bg: '#797582',  label: '작성중'   },
  submitted:          { bg: '#f57800',  label: '검토 대기' },
  approved:           { bg: '#0e9aa0',  label: '승인'     },
  confirmed:          { bg: K.primary,  label: '확정'     },
  rejected:           { bg: '#ba1a1a',  label: '반려'     },
  revision_requested: { bg: '#93000a',  label: '수정요청' },
};

export default function KpiReviewPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;
  const { hasFeature } = usePermissions();

  const { data: ruleSet } = useRuleSet(current?.ruleSetId ?? null);

  const allowed = !!user && canReview(user.role);
  const canApprove = hasFeature('KPI 승인/반려');

  const { data, loading, error, reload } = useKpis(
    { cycleId },
    { enabled: !!cycleId && allowed },
  );

  const { data: reviewsData, reload: reloadReviews } = useKpiReviews(
    { cycleId },
    { enabled: !!cycleId && allowed },
  );
  const reviewsByKpi = useMemo(() => {
    const map = new Map<string, KpiReview[]>();
    for (const r of reviewsData?.data ?? []) {
      const arr = map.get(r.kpiId) ?? [];
      arr.push(r);
      map.set(r.kpiId, arr);
    }
    return map;
  }, [reviewsData]);

  const reloadAll = () => {
    reload();
    reloadReviews();
  };

  const { data: usersData } = useUsers(
    { pageSize: 500 },
    { enabled: allowed },
  );
  const userInfo = useMemo(() => {
    const map = new Map<string, { name: string; position: string }>();
    for (const u of usersData?.data ?? []) {
      map.set(u.id, { name: u.name, position: getPositionLabel(u.position) });
    }
    return map;
  }, [usersData]);
  const userName = (uid: string) => userInfo.get(uid)?.name ?? uid.slice(0, 8);
  const userPosition = (uid: string) => userInfo.get(uid)?.position ?? '';

  const kpis = (data?.data ?? []).filter((k) => k.userId !== user?.id);
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
  // 배치 승인 확인 모달
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);

  const selectUser = (uid: string) => {
    setSelectedUser(uid);
    setActing(null);
    setReason('');
  };

  const activeSubmitted = activeKpis.filter((k) => k.status === 'submitted');
  const activeApproved  = activeKpis.filter((k) => k.status === 'approved');
  const activePending   = activeSubmitted.length + activeApproved.length;
  const activeConfirmed = activeKpis.filter((k) => k.status === 'confirmed');
  const weightTotal      = activeKpis.reduce((acc, k) => acc + k.weight, 0);
  const qualitativeTotal = activeKpis.filter((k) => k.isQualitative).reduce((acc, k) => acc + k.weight, 0);
  const hasCore   = activeKpis.some((k) => k.group === 'performance_core');
  const hasGrowth = activeKpis.some((k) => k.group === 'collaboration_growth');

  // 전체 진행률 — 확정+승인 / 전체(자신 제외)
  const processedCount = kpis.filter((k) => k.status === 'confirmed' || k.status === 'approved').length;
  const totalKpiCount  = kpis.length;
  const progressPct    = totalKpiCount > 0 ? Math.round((processedCount / totalKpiCount) * 100) : 0;

  const openReject = (kpiId: string, mode: 'reject' | 'revision') => {
    setActing({ kpiId, mode });
    setReason('');
  };
  const closeReject = () => {
    setActing(null);
    setReason('');
  };

  async function approveItem(k: Kpi) {
    if (!canApprove) return;
    setBusyId(k.id);
    try {
      await kpiCommands.approve(k.id);
      await kpiCommands.confirm(k.id);
      toast.show({ variant: 'success', message: '승인·확정했어요.' });
      reloadAll();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '승인에 실패했어요.',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmItem(k: Kpi) {
    if (!canApprove) return;
    setBusyId(k.id);
    try {
      await kpiCommands.confirm(k.id);
      toast.show({ variant: 'success', message: '확정했어요.' });
      reloadAll();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '확정에 실패했어요.',
      });
    } finally {
      setBusyId(null);
    }
  }

  // 배치 승인 — 현재 선택된 팀원의 submitted 과제를 모두 승인·확정
  async function batchApprove() {
    if (!canApprove || activeSubmitted.length === 0) return;
    setBatchBusy(true);
    setBatchConfirmOpen(false);
    let successCount = 0;
    let failCount = 0;
    for (const k of activeSubmitted) {
      try {
        await kpiCommands.approve(k.id);
        await kpiCommands.confirm(k.id);
        successCount++;
      } catch {
        failCount++;
      }
    }
    if (successCount > 0) {
      toast.show({ variant: 'success', message: `${successCount}개 과제를 승인·확정했어요.` });
    }
    if (failCount > 0) {
      toast.show({ variant: 'danger', message: `${failCount}개 과제는 처리에 실패했어요.` });
    }
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
      await kpiCommands.reject(acting.kpiId, r, trimmed);
      toast.show({
        variant: 'success',
        message: acting.mode === 'reject' ? '반려했어요.' : '수정요청했어요.',
      });
      closeReject();
      reloadAll();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '처리에 실패했어요.',
      });
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) {
    return <Forbidden message="KPI 검토는 팀장 이상만 접근할 수 있어요." />;
  }
  if (cyclesLoading || (loading && !data)) return <ReviewSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;

  const filteredUserIds = userIds.filter((uid) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      userName(uid).toLowerCase().includes(q) ||
      userPosition(uid).toLowerCase().includes(q)
    );
  });

  const summary = {
    total:    userIds.length,
    waiting:  submitted.length,
    approved: kpis.filter((k) => k.status === 'approved' || k.status === 'confirmed').length,
    rejected: kpis.filter((k) => k.status === 'rejected' || k.status === 'revision_requested').length,
  };

  return (
    <PageContainer>
      <PageHeader
        title="KPI 검토"
        subtitle="팀원의 KPI 작성 내용을 검토하고 승인/반려 처리합니다."
      />

      {/* 요약 카드 — §3-1 대형 수치 스케일 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: '검토 대상자',      value: summary.total,    color: K.primary,    Icon: Users         },
          { label: '검토 대기(과제)',  value: summary.waiting,  color: '#f57800',    Icon: AlertCircle   },
          { label: '승인·확정(과제)',  value: summary.approved, color: K.tertiary,   Icon: CheckCircle2  },
          { label: '반려·수정(과제)',  value: summary.rejected, color: '#ba1a1a',    Icon: XCircle       },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white p-5 rounded-xl border border-[#cac4d2]/50 flex flex-col items-center justify-center transition-transform hover:scale-[1.02] cursor-default"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <s.Icon size={18} color={s.color} style={{ marginBottom: 6, opacity: 0.7 }} />
            <span
              className="tabular-nums text-[34px] font-extrabold leading-[1.2] tracking-[-0.02em]"
              style={{ color: s.color }}
            >
              {s.value}
            </span>
            <span className="text-[#484551] text-[12px] font-semibold tracking-[0.01em] mt-1.5">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* 전체 진행률 바 */}
      {totalKpiCount > 0 && (
        <div
          className="px-5 py-4 rounded-xl"
          style={{ ...card }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={15} color={K.secondary} />
              <span style={{ fontSize: 13, fontWeight: 700, color: K.onSurface }}>전체 처리 현황</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: K.secondary }} className="tabular-nums">
              {processedCount} / {totalKpiCount}개 처리 ({progressPct}%)
            </span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 8, background: '#f2f3f7' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: progressPct === 100
                  ? `linear-gradient(90deg, ${K.tertiary}, #2ddbe4)`
                  : `linear-gradient(90deg, ${K.secondary}, #336fe5)`,
              }}
            />
          </div>
          {submitted.length > 0 && (
            <p style={{ fontSize: 11.5, color: '#f57800', marginTop: 8 }}>
              · 검토 대기 중인 과제 {submitted.length}개가 있어요.
            </p>
          )}
        </div>
      )}

      {userIds.length === 0 ? (
        <EmptyState
          title="검토할 KPI가 없어요."
          description="팀원이 KPI를 제출하면 여기서 검토할 수 있어요."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
          {/* 팀원 목록 */}
          <div className="overflow-hidden" style={card}>
            <div
              className="flex items-center gap-3 px-5 py-3 border-b"
              style={{ background: K.surfaceLow, borderColor: '#e7e8ec' }}
            >
              <h3 style={{ fontSize: 13, fontWeight: 700, color: K.onSurface }}>팀원 목록</h3>
              <div
                className="flex items-center gap-2 px-3 py-1.5 ml-auto"
                style={{ border: `1px solid ${K.outline}`, borderRadius: 999, minWidth: 148, background: K.white }}
              >
                <Search size={12} color={K.onSurfaceVariant} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="검색..."
                  className="outline-none"
                  style={{ fontSize: 12, background: 'transparent', color: K.onSurface, width: 90 }}
                />
              </div>
            </div>
            <ul>
              {filteredUserIds.length === 0 ? (
                <li className="py-8 text-center" style={{ fontSize: 13, color: K.onSurfaceVariant }}>
                  검색 결과가 없어요.
                </li>
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
                      className="flex w-full items-center gap-3 px-5 py-3.5 border-b last:border-b-0 text-left transition-colors"
                      style={{
                        borderColor: '#e7e8ec',
                        background: active ? 'rgba(63,44,128,0.06)' : 'transparent',
                        borderLeft: active ? `3px solid ${K.primary}` : '3px solid transparent',
                      }}
                    >
                      <div
                        className="flex-shrink-0 flex items-center justify-center"
                        style={{ width: 32, height: 32, borderRadius: '50%', background: K.primaryContainer, fontSize: 13, fontWeight: 700, color: '#fff' }}
                      >
                        {userName(uid).slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 13, fontWeight: 600, color: K.onSurface }} className="truncate">
                          {userName(uid)}
                          {userPosition(uid) && (
                            <span style={{ fontSize: 11, fontWeight: 400, color: K.onSurfaceVariant, marginLeft: 6 }}>
                              {userPosition(uid)}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: K.onSurfaceVariant }}>{list.length}개 과제</div>
                      </div>
                      <KpiStatusBadge status={displayStatus} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 검토 상세 */}
          <div className="overflow-hidden" style={card}>
            {/* 검토 상세 헤더 */}
            <div
              className="flex items-center gap-2 px-5 py-3 border-b"
              style={{ background: K.surfaceLow, borderColor: '#e7e8ec' }}
            >
              <ClipboardCheck size={15} color={K.secondary} />
              <h3 style={{ fontSize: 13, fontWeight: 700, color: K.onSurface }}>검토 상세</h3>
              {activeUser && (
                <span style={{ fontSize: 12, color: K.onSurfaceVariant }}>
                  · {userName(activeUser)}
                  {userPosition(activeUser) ? ` ${userPosition(activeUser)}` : ''}
                </span>
              )}
              {/* 배치 승인 버튼 */}
              {canApprove && activeSubmitted.length > 0 && (
                <button
                  onClick={() => setBatchConfirmOpen(true)}
                  disabled={batchBusy}
                  className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 text-white disabled:opacity-50"
                  style={{
                    fontSize: 12, fontWeight: 600,
                    background: K.secondary,
                    borderRadius: 7,
                    boxShadow: '0 2px 6px rgba(0,84,202,0.20)',
                  }}
                >
                  <CheckCheck size={13} />
                  {batchBusy ? '처리 중…' : `일괄 승인 (${activeSubmitted.length}개)`}
                </button>
              )}
            </div>

            {activeKpis.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center gap-2">
                <ClipboardCheck size={32} color="#cac4d2" />
                <p style={{ fontSize: 13, color: K.onSurfaceVariant }}>
                  선택한 팀원의 KPI가 없어요.
                </p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* 검증 요약 */}
                <div
                  className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3"
                  style={{ fontSize: 12.5, background: K.surfaceLow, borderRadius: 12, border: '1px solid rgba(202,196,210,0.5)' }}
                >
                  <CheckText ok={weightTotal === 100}>가중치 합 {weightTotal}%</CheckText>
                  <CheckText ok={qualitativeTotal <= 30}>정성 {qualitativeTotal}%</CheckText>
                  <CheckText ok={hasCore}>성과중심 {hasCore ? '충족' : '미충족'}</CheckText>
                  <CheckText ok={hasGrowth}>협업·성장 {hasGrowth ? '충족' : '미충족'}</CheckText>
                </div>

                {/* 상태 안내 */}
                {activePending === 0 ? (
                  activeConfirmed.length > 0 ? (
                    <InfoBanner tone="success">
                      검토·확정이 완료된 과제예요.
                    </InfoBanner>
                  ) : (
                    <InfoBanner tone="info">
                      검토 대기(제출 상태) 과제가 없어요. 팀원이 KPI를 제출하면 문항별로 승인·반려·수정요청을 처리할 수 있어요.
                    </InfoBanner>
                  )
                ) : !canApprove ? (
                  <InfoBanner tone="warning">
                    KPI 승인/반려 권한이 없어 처리할 수 없어요. 관리자에게 문의하세요.
                  </InfoBanner>
                ) : null}

                {/* 과제 목록 */}
                <div className="space-y-3">
                  {activeKpis.map((k) => {
                    const cc = categoryChip[k.category] ?? categoryChip.orders;
                    return (
                      <div
                        key={k.id}
                        className="overflow-hidden transition-all"
                        style={{
                          background: K.white,
                          border: '1px solid rgba(202,196,210,0.5)',
                          borderRadius: 12,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(63,44,128,0.25)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(202,196,210,0.5)'; }}
                      >
                        <div className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="px-2 py-0.5"
                              style={{ fontSize: 10.5, fontWeight: 600, background: cc.bg, color: cc.color, borderRadius: 4 }}
                            >
                              {kpiCategoryLabel[k.category]}
                            </span>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: K.onSurface }}>{k.title}</span>
                            <span
                              className="ml-auto px-2.5 py-0.5 tabular-nums"
                              style={{ fontSize: 11, color: K.primary, border: `1px solid rgba(63,44,128,0.2)`, background: 'rgba(63,44,128,0.05)', borderRadius: 4, fontWeight: 600 }}
                            >
                              가중치 {k.weight}%
                            </span>
                            <KpiStatusBadge status={k.status} />
                          </div>
                          <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1" style={{ fontSize: 11.5, color: K.onSurfaceVariant, marginTop: 6 }}>
                            <span>{kpiGroupLabel[k.group]}</span>
                            <span>·</span>
                            <QualBadge isQualitative={k.isQualitative} />
                            {k.measureMethod ? (
                              <>
                                <span>·</span>
                                <span>{k.measureMethod}</span>
                              </>
                            ) : null}
                            {k.targetText
                              ? (
                                <>
                                  <span>·</span>
                                  <span>목표 {k.targetText}</span>
                                </>
                              )
                              : k.targetValue !== null
                                ? (
                                  <>
                                    <span>·</span>
                                    <span>목표 {k.targetValue}{measureTypeUnit[k.measureType]}</span>
                                  </>
                                )
                                : null}
                          </div>
                          <KpiGradingDisplay kpi={k} scales={ruleSet?.gradingScales} />
                          <ReviewHistory
                            reviews={reviewsByKpi.get(k.id) ?? []}
                            rejectReason={k.status === 'draft' ? k.rejectReason : null}
                          />
                        </div>
                        {canApprove && (k.status === 'submitted' || k.status === 'approved') && (
                          <div
                            className="flex flex-wrap justify-end gap-2 px-4 py-3"
                            style={{ background: K.surfaceLow, borderTop: '1px solid #e7e8ec' }}
                          >
                            {k.status === 'submitted' ? (
                              <>
                                <button
                                  onClick={() => openReject(k.id, 'reject')}
                                  disabled={busyId !== null || batchBusy}
                                  className="flex items-center gap-1.5 px-3.5 py-2 text-white disabled:opacity-50"
                                  style={{ fontSize: 12.5, fontWeight: 600, background: '#ba1a1a', borderRadius: 7 }}
                                >
                                  <X size={13} /> 반려
                                </button>
                                <button
                                  onClick={() => openReject(k.id, 'revision')}
                                  disabled={busyId !== null || batchBusy}
                                  className="flex items-center gap-1.5 px-3.5 py-2 disabled:opacity-50"
                                  style={{ fontSize: 12.5, fontWeight: 600, color: K.onSurfaceVariant, border: `1px solid ${K.outline}`, background: K.white, borderRadius: 7 }}
                                >
                                  <MessageSquare size={13} /> 수정요청
                                </button>
                                <button
                                  onClick={() => void approveItem(k)}
                                  disabled={busyId !== null || batchBusy}
                                  className="flex items-center gap-1.5 px-3.5 py-2 text-white disabled:opacity-50"
                                  style={{ fontSize: 12.5, fontWeight: 600, background: K.secondary, borderRadius: 7 }}
                                >
                                  <Check size={13} /> {busyId === k.id ? '처리 중…' : '승인'}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => void confirmItem(k)}
                                disabled={busyId !== null || batchBusy}
                                className="flex items-center gap-1.5 px-3.5 py-2 text-white disabled:opacity-50"
                                style={{ fontSize: 12.5, fontWeight: 600, background: K.primary, borderRadius: 7 }}
                              >
                                <Check size={13} /> {busyId === k.id ? '처리 중…' : '확정'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
              ? '반려하면 작성한 사유가 작성자에게 전달되고, 해당 문항은 작성중으로 돌아가요.'
              : '수정요청하면 작성자에게 수정 사유가 전달되고, 작성자가 내용을 수정한 뒤 재제출해야 해요.'}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
            placeholder={
              acting?.mode === 'reject'
                ? '반려 사유를 작성해 주세요.'
                : '수정 요청 사항을 작성해 주세요.'
            }
            className="w-full resize-none outline-none"
            style={{
              border: `1px solid ${K.outline}`,
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12.5,
              color: K.onSurface,
              minHeight: 90,
              background: K.surfaceLow,
              transition: 'border-color .12s, box-shadow .12s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = K.secondary;
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,84,202,0.10)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = K.outline;
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          {reason.trim().length === 0 && (
            <p style={{ fontSize: 11, color: '#ba1a1a', marginTop: 3 }}>사유를 입력해야 처리할 수 있어요.</p>
          )}
        </div>
      </Modal>

      {/* 일괄 승인 확인 모달 */}
      <Modal
        open={batchConfirmOpen}
        onClose={() => setBatchConfirmOpen(false)}
        title={`${activeSubmitted.length}개 과제를 일괄 승인할까요?`}
        primaryAction={{
          label: '일괄 승인',
          variant: 'primary' as const,
          loading: batchBusy,
          onClick: () => void batchApprove(),
        }}
        secondaryAction={{ label: '취소', onClick: () => setBatchConfirmOpen(false) }}
        size="sm"
      >
        <p style={{ fontSize: 13, color: K.onSurfaceVariant }}>
          {activeUser && (
            <><strong style={{ color: K.onSurface }}>{userName(activeUser)}</strong>님의 제출된 과제 {activeSubmitted.length}개를 모두 승인·확정해요. 개별 확인이 필요한 과제는 먼저 검토해 주세요.</>
          )}
        </p>
      </Modal>
    </PageContainer>
  );
}

// ── 서브 컴포넌트 ───────────────────────────────────────────────

function QualBadge({ isQualitative }: { isQualitative: boolean }) {
  const style = isQualitative
    ? { bg: 'rgba(63,44,128,0.1)', color: K.primary, label: '정성' }
    : { bg: 'rgba(0,84,202,0.08)', color: K.secondary, label: '정량' };
  return (
    <span
      className="px-1.5 py-0.5"
      style={{ fontSize: 10.5, fontWeight: 600, background: style.bg, color: style.color, borderRadius: 3 }}
    >
      {style.label}
    </span>
  );
}

function ReviewHistory({
  reviews,
  rejectReason,
}: {
  reviews: KpiReview[];
  rejectReason: string | null;
}) {
  if (reviews.length === 0 && !rejectReason) return null;
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  return (
    <div className="mt-3 pt-3 space-y-2" style={{ borderTop: `1px dashed ${K.outlineDim}` }}>
      <div className="flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 600, color: K.onSurfaceVariant }}>
        <MessageSquare size={12} /> 검토 의견
      </div>
      {rejectReason && (
        <div className="px-3 py-2" style={{ background: '#ffdad6', borderLeft: `2px solid #ba1a1a`, borderRadius: '0 4px 4px 0' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#ba1a1a', marginBottom: 2 }}>반려 사유</div>
          <div style={{ fontSize: 12, color: '#191c1f', whiteSpace: 'pre-wrap' }}>{rejectReason}</div>
        </div>
      )}
      {reviews.map((r) => {
        const improvement = r.kind === 'improvement';
        return (
          <div
            key={r.id}
            className="px-3 py-2"
            style={{
              background: improvement ? 'rgba(245,120,0,0.08)' : 'rgba(14,154,160,0.08)',
              borderLeft: `2px solid ${improvement ? '#f57800' : '#0e9aa0'}`,
              borderRadius: '0 4px 4px 0',
            }}
          >
            <div className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: 10.5, marginBottom: 2 }}>
              <span style={{ fontWeight: 600, color: improvement ? '#f57800' : '#0e9aa0' }}>
                {improvement ? '보완·반려 의견' : '승인 의견'}
              </span>
              <span style={{ color: K.onSurfaceVariant }}>· {r.authorName}{r.authorPosition ? ` ${r.authorPosition}` : ''}</span>
              <span className="ml-auto" style={{ color: K.onSurfaceVariant, opacity: 0.7 }}>{fmt(r.createdAt)}</span>
            </div>
            <div style={{ fontSize: 12, color: K.onSurface, whiteSpace: 'pre-wrap' }}>{r.content}</div>
          </div>
        );
      })}
    </div>
  );
}

function CheckText({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1" style={{ color: ok ? '#0e9aa0' : K.onSurfaceVariant }}>
      {ok ? <Check size={13} /> : <span style={{ width: 13, textAlign: 'center' }}>·</span>}
      {children}
    </span>
  );
}

function KpiStatusBadge({ status }: { status: KpiStatus }) {
  const s = STATUS_CFG[status];
  return (
    <span className="px-2.5 py-1 text-white" style={{ fontSize: 11, fontWeight: 600, background: s.bg, borderRadius: 999 }}>
      {s.label}
    </span>
  );
}

function ReviewSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </PageContainer>
  );
}
