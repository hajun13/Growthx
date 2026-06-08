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
import { T, categoryChip } from '@/lib/toss';
import { KpiGradingDisplay } from '@/components/KpiGradingDisplay';
import type { Kpi, KpiReview, KpiStatus } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';

const card: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${T.grey200}`,
};

const STATUS_CFG: Record<KpiStatus, { bg: string; label: string }> = {
  draft: { bg: T.grey500, label: '작성중' },
  submitted: { bg: T.orange500, label: '검토 대기' },
  approved: { bg: T.green500, label: '승인' },
  confirmed: { bg: T.blue700, label: '확정' },
  rejected: { bg: T.red500, label: '반려' },
  revision_requested: { bg: '#d22030', label: '수정요청' },
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

  const kpis = data?.data ?? [];
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
  if (cyclesLoading || loading) return <ReviewSkeleton />;
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
          { label: '검토 대상자', bg: T.blue500, value: summary.total },
          { label: '검토 대기(과제)', bg: T.orange500, value: summary.waiting },
          { label: '승인·확정(과제)', bg: T.green500, value: summary.approved },
          { label: '반려·수정요청(과제)', bg: '#d22030', value: summary.rejected },
        ].map((s, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3" style={card}>
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: s.bg }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{s.value}</span>
            </div>
            <div style={{ fontSize: 12.5, color: T.grey700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {userIds.length === 0 ? (
        <EmptyState title="검토할 KPI가 없어요." />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
          {/* 팀원 목록 */}
          <div className="overflow-hidden" style={card}>
            <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ background: T.grey50, borderColor: T.grey200 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>팀원 목록</h3>
              <div
                className="flex items-center gap-2 px-3 py-1.5 ml-auto"
                style={{ border: `1px solid ${T.grey200}`, minWidth: 140 }}
              >
                <Search size={12} color={T.grey500} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="검색..."
                  className="outline-none"
                  style={{ fontSize: 12, background: 'transparent', color: T.grey900, width: 90 }}
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
                      className="flex w-full items-center gap-2.5 px-5 py-3.5 border-b last:border-b-0 text-left transition-colors"
                      style={{ borderColor: T.grey200, background: active ? '#F5F7FF' : 'transparent' }}
                    >
                      <div
                        className="w-8 h-8 flex items-center justify-center"
                        style={{ background: T.blue500, fontSize: 12, fontWeight: 700, color: '#fff' }}
                      >
                        {userName(uid).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }} className="truncate">
                          {userName(uid)}
                          {userPosition(uid) && (
                            <span style={{ fontSize: 11, fontWeight: 400, color: T.grey500, marginLeft: 6 }}>
                              {userPosition(uid)}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: T.grey500 }}>{list.length}개 과제</div>
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
            <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ background: T.grey50, borderColor: T.grey200 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>검토 상세</h3>
              {activeUser && (
                <span style={{ fontSize: 12, color: T.grey500 }}>
                  · {userName(activeUser)}
                  {userPosition(activeUser) ? ` ${userPosition(activeUser)}` : ''}
                </span>
              )}
            </div>
            {activeKpis.length === 0 ? (
              <div className="p-8 text-center" style={{ fontSize: 13, color: T.grey500 }}>
                선택한 팀원의 KPI가 없어요.
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* 과제 목록 */}
                <div className="space-y-2">
                  {activeKpis.map((k) => {
                    const cc = categoryChip[k.category] ?? categoryChip.orders;
                    return (
                      <div
                        key={k.id}
                        className="px-4 py-3 border"
                        style={{ borderColor: T.grey200 }}
                      >
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2 py-0.5" style={{ fontSize: 10.5, fontWeight: 600, background: cc.bg, color: cc.color }}>
                            {kpiCategoryLabel[k.category]}
                          </span>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: T.grey900 }}>{k.title}</span>
                          <span className="ml-auto px-2 py-0.5" style={{ fontSize: 11, color: T.grey600, border: `1px solid ${T.grey200}` }}>
                            가중치 {k.weight}%
                          </span>
                          <KpiStatusBadge status={k.status} />
                        </div>
                        <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1" style={{ fontSize: 11.5, color: T.grey500, marginTop: 6 }}>
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
                        {canApprove && (k.status === 'submitted' || k.status === 'approved') && (
                          <div
                            className="mt-3 pt-3 flex flex-wrap justify-end gap-2"
                            style={{ borderTop: `1px dashed ${T.grey200}` }}
                          >
                            {k.status === 'submitted' ? (
                              <>
                                <button
                                  onClick={() => openReject(k.id, 'reject')}
                                  disabled={busyId !== null}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-white disabled:opacity-50"
                                  style={{ fontSize: 12.5, fontWeight: 600, background: T.red500 }}
                                >
                                  <X size={13} /> 반려
                                </button>
                                <button
                                  onClick={() => openReject(k.id, 'revision')}
                                  disabled={busyId !== null}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 disabled:opacity-50"
                                  style={{ fontSize: 12.5, fontWeight: 600, color: T.grey700, border: `1px solid ${T.grey200}`, background: '#fff' }}
                                >
                                  <MessageSquare size={13} /> 수정요청
                                </button>
                                <button
                                  onClick={() => void approveItem(k)}
                                  disabled={busyId !== null}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-white disabled:opacity-50"
                                  style={{ fontSize: 12.5, fontWeight: 600, background: T.blue500 }}
                                >
                                  <Check size={13} /> {busyId === k.id ? '처리 중…' : '승인'}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => void confirmItem(k)}
                                disabled={busyId !== null}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 text-white disabled:opacity-50"
                                style={{ fontSize: 12.5, fontWeight: 600, background: T.blue500 }}
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
                <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ fontSize: 12.5 }}>
                  <CheckText ok={weightTotal === 100}>가중치 합 {weightTotal}%</CheckText>
                  <CheckText ok={qualitativeTotal <= 30}>정성 {qualitativeTotal}%</CheckText>
                  <CheckText ok={hasCore}>성과중심 {hasCore ? '충족' : '미충족'}</CheckText>
                  <CheckText ok={hasGrowth}>협업·성장 {hasGrowth ? '충족' : '미충족'}</CheckText>
                </div>

                {activePending === 0 ? (
                  activeConfirmed.length > 0 ? (
                    <p style={{ fontSize: 13, color: T.grey500 }}>
                      검토·확정이 완료된 과제예요.
                    </p>
                  ) : (
                    <p style={{ fontSize: 13, color: T.grey500 }}>
                      검토 대기(제출 상태) 과제가 없어요. 팀원이 KPI를 제출하면 문항별로 승인·반려·수정요청을 처리할 수 있어요.
                    </p>
                  )
                ) : !canApprove ? (
                  <p style={{ fontSize: 12.5, color: T.grey500 }}>
                    KPI 승인/반려 권한이 없어 처리할 수 없어요. 관리자에게 문의하세요.
                  </p>
                ) : (
                  <p style={{ fontSize: 12.5, color: T.grey500 }}>
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
          <p style={{ fontSize: 13, color: T.grey700 }}>
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
              border: `1px solid ${T.grey200}`,
              padding: '10px 12px',
              fontSize: 12.5,
              color: T.grey700,
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
  // 정성=퍼플 액센트(작성 화면 토글과 동일), 정량=중립 그레이로 화면 간 색 의미 통일.
  const style = isQualitative
    ? { bg: '#f3e8ff', color: '#7c3aed', label: '정성' }
    : { bg: T.grey100, color: T.grey600, label: '정량' };
  return (
    <span
      className="px-1.5 py-0.5"
      style={{ fontSize: 10.5, fontWeight: 600, background: style.bg, color: style.color }}
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
    <div className="mt-3 pt-3 space-y-2" style={{ borderTop: `1px dashed ${T.grey200}` }}>
      <div className="flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>
        <MessageSquare size={12} /> 검토 의견
      </div>
      {rejectReason && (
        <div className="px-3 py-2" style={{ background: '#FEF2F2', borderLeft: `2px solid ${T.red500}` }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: T.red500, marginBottom: 2 }}>반려 사유</div>
          <div style={{ fontSize: 12, color: T.grey700, whiteSpace: 'pre-wrap' }}>{rejectReason}</div>
        </div>
      )}
      {reviews.map((r) => {
        const improvement = r.kind === 'improvement';
        return (
          <div
            key={r.id}
            className="px-3 py-2"
            style={{
              background: improvement ? '#FFF7ED' : '#F0FDF4',
              borderLeft: `2px solid ${improvement ? T.orange500 : T.green500}`,
            }}
          >
            <div className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: 10.5, marginBottom: 2 }}>
              <span style={{ fontWeight: 600, color: improvement ? '#c2410c' : '#15803d' }}>
                {improvement ? '보완·반려 의견' : '승인 의견'}
              </span>
              <span style={{ color: T.grey500 }}>· {r.authorName}{r.authorPosition ? ` ${r.authorPosition}` : ''}</span>
              <span className="ml-auto" style={{ color: T.grey400 }}>{fmt(r.createdAt)}</span>
            </div>
            <div style={{ fontSize: 12, color: T.grey700, whiteSpace: 'pre-wrap' }}>{r.content}</div>
          </div>
        );
      })}
    </div>
  );
}

function CheckText({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1" style={{ color: ok ? T.green500 : T.grey500 }}>
      {ok ? <Check size={13} /> : <span style={{ width: 13, textAlign: 'center' }}>·</span>}
      {children}
    </span>
  );
}

function KpiStatusBadge({ status }: { status: KpiStatus }) {
  const s = STATUS_CFG[status];
  return (
    <span className="px-2.5 py-1 text-white" style={{ fontSize: 11, fontWeight: 600, background: s.bg }}>
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
