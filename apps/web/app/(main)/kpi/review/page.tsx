'use client';

import { useMemo, useState } from 'react';
import { Check, X, MessageSquare, Search } from 'lucide-react';
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

// ── Kinetic Enterprise 팔레트 ───────────────────────────────────
const K = {
  primary: '#3f2c80',
  primaryContainer: '#564599',
  secondary: '#0054ca',
  secondaryDim: '#336fe5',
  tertiary: '#0e9aa0',
  surface: '#f8f9fd',
  surfaceLow: '#f2f3f7',
  white: '#ffffff',
  onSurface: '#191c1f',
  onSurfaceVariant: '#484551',
  outline: '#cac4d2',
  outlineDim: 'rgba(202,196,210,0.4)',
} as const;

const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

const card: React.CSSProperties = {
  background: K.white,
  border: '1px solid rgba(202,196,210,0.5)',
  borderRadius: 12,
  boxShadow: CARD_SHADOW,
};

const STATUS_CFG: Record<KpiStatus, { bg: string; label: string }> = {
  draft: { bg: '#797582', label: '작성중' },
  submitted: { bg: '#f57800', label: '검토 대기' },
  approved: { bg: '#0e9aa0', label: '승인' },
  confirmed: { bg: K.primary, label: '확정' },
  rejected: { bg: '#ba1a1a', label: '반려' },
  revision_requested: { bg: '#93000a', label: '수정요청' },
};

export default function KpiReviewPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;
  const { hasFeature } = usePermissions();

  // amount/rate 측정방식은 KPI별 기준이 없고 사이클 공통 달성률표(RuleSet)를 따른다 → 등급 기준 표시에 사용.
  const { data: ruleSet } = useRuleSet(current?.ruleSetId ?? null);

  const allowed = !!user && canReview(user.role);
  // 권한 매트릭스 추가 차단(restrict-only) — false 면 승인/반려/수정요청 비활성.
  const canApprove = hasFeature('KPI 승인/반려');

  const { data, loading, error, reload } = useKpis(
    { cycleId },
    { enabled: !!cycleId && allowed },
  );

  // 검토 의견 이력 — 사이클 전체를 한 번에 불러와 kpiId 별로 묶는다(승인·반려 후 reload).
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
  // KPI 목록과 검토 의견을 함께 새로고침.
  const reloadAll = () => {
    reload();
    reloadReviews();
  };

  // 사용자 목록 — KPI 객체에 이름이 없어 userId→{name,position} 맵으로 표시.
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
  // 이름 폴백: 사용자 정보 없으면 userId 8자.
  const userName = (uid: string) => userInfo.get(uid)?.name ?? uid.slice(0, 8);
  const userPosition = (uid: string) => userInfo.get(uid)?.position ?? '';

  // 검토자 본인의 KPI는 검토 대상에서 제외 — 자기 KPI는 상위(2차 평가자)가 검토한다.
  // (제외하지 않으면 평가를 진행하는 부서장 본인이 '검토 대상자' 목록에 떠버린다.)
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

  // 문항별 처리 — 진행 중인 KPI id(버튼 비활성화용).
  const [busyId, setBusyId] = useState<string | null>(null);
  // 반려/수정요청 사유 입력 모달 대상(문항 단위).
  const [acting, setActing] = useState<{ kpiId: string; mode: 'reject' | 'revision' } | null>(null);
  const [reason, setReason] = useState('');

  // 팀원 전환 시 열려 있던 반려/수정요청 모달은 닫는다.
  const selectUser = (uid: string) => {
    setSelectedUser(uid);
    setActing(null);
    setReason('');
  };

  const activeSubmitted = activeKpis.filter((k) => k.status === 'submitted');
  // 승인만 되고 확정 전(approved)인 과제 — 본인평가는 confirmed만 대상이라 확정으로 마무리해야 한다.
  const activeApproved = activeKpis.filter((k) => k.status === 'approved');
  const activePending = activeSubmitted.length + activeApproved.length;
  // 이미 확정된 과제 — 검토 대기가 없는 사유를 '미제출'과 '확정 완료'로 구분하기 위함.
  const activeConfirmed = activeKpis.filter((k) => k.status === 'confirmed');
  const weightTotal = activeKpis.reduce((acc, k) => acc + k.weight, 0);
  const qualitativeTotal = activeKpis
    .filter((k) => k.isQualitative)
    .reduce((acc, k) => acc + k.weight, 0);
  const hasCore = activeKpis.some((k) => k.group === 'performance_core');
  const hasGrowth = activeKpis.some((k) => k.group === 'collaboration_growth');

  const openReject = (kpiId: string, mode: 'reject' | 'revision') => {
    setActing({ kpiId, mode });
    setReason('');
  };
  const closeReject = () => {
    setActing(null);
    setReason('');
  };

  // 문항 승인 — 코멘트 불필요. 본인평가는 confirmed만 대상이라 승인(→approved) 직후 확정(→confirmed)까지 진행.
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

  // 승인만 되고 확정 전인 문항을 확정으로 마무리(레거시 데이터 보정).
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

  // 문항 반려/수정요청 — 사유 필수. 수정요청은 reason 접두사로 구분(둘 다 작성중으로 복귀).
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
  // 스켈레톤은 "첫 로딩(데이터 없음)"에만 — 승인·반려 후 reload 때 전체 교체되면
  // 리스트가 리마운트돼 스크롤이 맨 위로 튄다. 재로딩 중엔 기존 목록을 유지.
  if (cyclesLoading || (loading && !data)) return <ReviewSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;

  // 검토 대상자 요약(이름·직급 검색)
  const filteredUserIds = userIds.filter((uid) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      userName(uid).toLowerCase().includes(q) ||
      userPosition(uid).toLowerCase().includes(q)
    );
  });

  const summary = {
    total: userIds.length,
    waiting: submitted.length,
    approved: kpis.filter((k) => k.status === 'approved' || k.status === 'confirmed').length,
    rejected: kpis.filter((k) => k.status === 'rejected' || k.status === 'revision_requested').length,
  };

  return (
    <PageContainer>
      <PageHeader
        title="KPI 검토"
        subtitle="팀원의 KPI 작성 내용을 검토하고 승인/반려 처리합니다."
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '검토 대상자', bg: K.primary, value: summary.total },
          { label: '검토 대기(과제)', bg: '#f57800', value: summary.waiting },
          { label: '승인·확정(과제)', bg: K.tertiary, value: summary.approved },
          { label: '반려·수정요청(과제)', bg: '#ba1a1a', value: summary.rejected },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4" style={card}>
            <div
              className="flex-shrink-0 flex items-center justify-center"
              style={{ width: 48, height: 48, borderRadius: 10, background: s.bg + '15' }}
            >
              <span className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: s.bg, lineHeight: 1 }}>{s.value}</span>
            </div>
            <div style={{ fontSize: 13, color: K.onSurfaceVariant, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {userIds.length === 0 ? (
        <EmptyState title="검토할 KPI가 없어요." />
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
              {filteredUserIds.map((uid) => {
                const list = byUser.get(uid) ?? [];
                const head = list[0];
                const active = uid === activeUser;
                const sub = list.some((k) => k.status === 'submitted');
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
                      {head && <KpiStatusBadge status={sub ? 'submitted' : head.status} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 검토 상세 */}
          <div className="overflow-hidden" style={card}>
            <div
              className="flex items-center gap-2 px-5 py-3 border-b"
              style={{ background: K.surfaceLow, borderColor: '#e7e8ec' }}
            >
              <h3 style={{ fontSize: 13, fontWeight: 700, color: K.onSurface }}>검토 상세</h3>
              {activeUser && (
                <span style={{ fontSize: 12, color: K.onSurfaceVariant }}>
                  · {userName(activeUser)}
                  {userPosition(activeUser) ? ` ${userPosition(activeUser)}` : ''}
                </span>
              )}
            </div>
            {activeKpis.length === 0 ? (
              <div className="p-8 text-center" style={{ fontSize: 13, color: K.onSurfaceVariant }}>
                선택한 팀원의 KPI가 없어요.
              </div>
            ) : (
              <div className="p-5 space-y-4">
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
                                  disabled={busyId !== null}
                                  className="flex items-center gap-1.5 px-3.5 py-2 text-white disabled:opacity-50"
                                  style={{ fontSize: 12.5, fontWeight: 600, background: '#ba1a1a', borderRadius: 7 }}
                                >
                                  <X size={13} /> 반려
                                </button>
                                <button
                                  onClick={() => openReject(k.id, 'revision')}
                                  disabled={busyId !== null}
                                  className="flex items-center gap-1.5 px-3.5 py-2 disabled:opacity-50"
                                  style={{ fontSize: 12.5, fontWeight: 600, color: K.onSurfaceVariant, border: `1px solid ${K.outline}`, background: K.white, borderRadius: 7 }}
                                >
                                  <MessageSquare size={13} /> 수정요청
                                </button>
                                <button
                                  onClick={() => void approveItem(k)}
                                  disabled={busyId !== null}
                                  className="flex items-center gap-1.5 px-3.5 py-2 text-white disabled:opacity-50"
                                  style={{ fontSize: 12.5, fontWeight: 600, background: K.secondary, borderRadius: 7 }}
                                >
                                  <Check size={13} /> {busyId === k.id ? '처리 중…' : '승인'}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => void confirmItem(k)}
                                disabled={busyId !== null}
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

                {activePending === 0 ? (
                  activeConfirmed.length > 0 ? (
                    <p style={{ fontSize: 13, color: K.onSurfaceVariant }}>
                      검토·확정이 완료된 과제예요.
                    </p>
                  ) : (
                    <p style={{ fontSize: 13, color: K.onSurfaceVariant }}>
                      검토 대기(제출 상태) 과제가 없어요. 팀원이 KPI를 제출하면 문항별로 승인·반려·수정요청을 처리할 수 있어요.
                    </p>
                  )
                ) : !canApprove ? (
                  <p style={{ fontSize: 12.5, color: K.onSurfaceVariant }}>
                    KPI 승인/반려 권한이 없어 처리할 수 없어요. 관리자에게 문의하세요.
                  </p>
                ) : (
                  <p style={{ fontSize: 12.5, color: K.onSurfaceVariant }}>
                    각 문항 카드에서 승인·반려·수정요청을 개별로 처리할 수 있어요. 승인은 코멘트 없이 바로 처리돼요.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
            작성한 사유가 작성자에게 전달되고, 해당 문항은 작성중으로 돌아가요.
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
            }}
          />
        </div>
      </Modal>
    </PageContainer>
  );
}

// 정성/정량은 measureType enum이 아니라 작성자 토글(isQualitative) 선언으로 구분한다.
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

// 과제별 검토 의견 이력 — 승인(strength)·반려/수정요청(improvement) 코멘트를 최신순으로 표시.
// 확정 후에도 남아 "코멘트가 사라진다"는 문제를 해결한다.
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </PageContainer>
  );
}
