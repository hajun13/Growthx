'use client';

import { useMemo, useState } from 'react';
import { Check, X, MessageSquare, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useKpis, kpiCommands } from '@/hooks/useKpis';
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
import type { Kpi, KpiStatus } from '@/lib/types';
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

  const allowed = !!user && canReview(user.role);
  // 권한 매트릭스 추가 차단(restrict-only) — false 면 승인/반려/수정요청 비활성.
  const canApprove = hasFeature('KPI 승인/반려');

  const { data, loading, error, reload } = useKpis(
    { cycleId },
    { enabled: !!cycleId && allowed },
  );

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

  // 사용자별 코멘트 드래프트 분리 보관 — 다른 팀원으로 전환해도 각자 입력이 유지된다.
  const [commentByUser, setCommentByUser] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [rejectMode, setRejectMode] = useState<'reject' | 'revision' | null>(null);

  const activeComment = activeUser ? (commentByUser[activeUser] ?? '') : '';
  const setActiveComment = (value: string) => {
    if (!activeUser) return;
    setCommentByUser((prev) => ({ ...prev, [activeUser]: value }));
  };
  const clearActiveComment = () => {
    if (!activeUser) return;
    setCommentByUser((prev) => ({ ...prev, [activeUser]: '' }));
  };

  // 팀원 전환 시 열려 있던 반려/수정요청 모달은 닫는다.
  const selectUser = (uid: string) => {
    setSelectedUser(uid);
    setRejectMode(null);
  };

  const activeSubmitted = activeKpis.filter((k) => k.status === 'submitted');
  const weightTotal = activeKpis.reduce((acc, k) => acc + k.weight, 0);
  const qualitativeTotal = activeKpis
    .filter((k) => k.isQualitative)
    .reduce((acc, k) => acc + k.weight, 0);
  const hasCore = activeKpis.some((k) => k.group === 'performance_core');
  const hasGrowth = activeKpis.some((k) => k.group === 'collaboration_growth');

  const commentRequired = activeComment.trim().length === 0;

  async function approveAll() {
    if (commentRequired || !canApprove) return;
    const trimmed = activeComment.trim();
    setBusy(true);
    try {
      for (const k of activeSubmitted) {
        await kpiCommands.approve(k.id, trimmed);
      }
      toast.show({ variant: 'success', message: '승인했어요.' });
      clearActiveComment();
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '승인에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject() {
    if (commentRequired || !rejectMode || !canApprove) return;
    const trimmed = activeComment.trim();
    setBusy(true);
    try {
      const reason =
        rejectMode === 'revision' ? `[수정요청] ${trimmed}` : trimmed;
      for (const k of activeSubmitted) {
        await kpiCommands.reject(k.id, reason, trimmed);
      }
      toast.show({
        variant: 'success',
        message: rejectMode === 'reject' ? '반려했어요.' : '수정요청했어요.',
      });
      clearActiveComment();
      setRejectMode(null);
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '처리에 실패했어요.',
      });
    } finally {
      setBusy(false);
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

                {/* 코멘트 */}
                <label className="flex flex-col gap-1.5">
                  <span style={{ fontSize: 11.5, color: T.grey500, fontWeight: 500 }}>
                    검토 코멘트 <span style={{ color: T.red500 }}>*</span>
                  </span>
                  <textarea
                    value={activeComment}
                    onChange={(e) => setActiveComment(e.target.value)}
                    placeholder="승인·반려·수정요청 사유를 작성해 주세요."
                    className="resize-none outline-none"
                    style={{
                      border: `1px solid ${commentRequired ? '#FCA5A5' : T.grey200}`,
                      padding: '10px 12px',
                      fontSize: 12.5,
                      color: T.grey700,
                      minHeight: 80,
                    }}
                  />
                  {commentRequired && (
                    <span style={{ fontSize: 11.5, color: T.red500 }}>
                      코멘트를 작성해야 처리할 수 있어요.
                    </span>
                  )}
                </label>

                {activeSubmitted.length === 0 ? (
                  <p style={{ fontSize: 13, color: T.grey500 }}>검토 대기(제출 상태) 과제가 없어요.</p>
                ) : (
                  <div className="flex flex-col items-end gap-2">
                    {!canApprove && (
                      <p style={{ fontSize: 11.5, color: T.grey500 }}>
                        KPI 승인/반려 권한이 없어 처리할 수 없어요. 관리자에게 문의하세요.
                      </p>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() => setRejectMode('reject')}
                        disabled={commentRequired || busy || !canApprove}
                        className="flex items-center gap-1.5 px-4 py-2 text-white disabled:opacity-50"
                        style={{ fontSize: 13, fontWeight: 600, background: T.red500 }}
                      >
                        <X size={14} /> 반려
                      </button>
                      <button
                        onClick={() => setRejectMode('revision')}
                        disabled={commentRequired || busy || !canApprove}
                        className="flex items-center gap-1.5 px-4 py-2 disabled:opacity-50"
                        style={{ fontSize: 13, fontWeight: 600, color: T.grey700, border: `1px solid ${T.grey200}`, background: '#fff' }}
                      >
                        <MessageSquare size={14} /> 수정요청
                      </button>
                      <button
                        onClick={() => void approveAll()}
                        disabled={commentRequired || busy || !canApprove}
                        className="flex items-center gap-1.5 px-4 py-2 text-white disabled:opacity-50"
                        style={{ fontSize: 13, fontWeight: 600, background: T.blue500 }}
                      >
                        <Check size={14} /> {busy ? '처리 중…' : '승인'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={rejectMode !== null}
        onClose={() => setRejectMode(null)}
        title={rejectMode === 'reject' ? '반려할까요?' : '수정요청할까요?'}
        primaryAction={{
          label: rejectMode === 'reject' ? '반려' : '수정요청',
          variant: 'danger',
          loading: busy,
          onClick: () => void confirmReject(),
        }}
        secondaryAction={{ label: '취소', onClick: () => setRejectMode(null) }}
      >
        작성된 코멘트와 함께 작성자에게 전달되고, 과제는 작성중으로 돌아가요.
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
