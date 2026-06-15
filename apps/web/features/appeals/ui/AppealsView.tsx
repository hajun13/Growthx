'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  MessageSquareWarning,
  Plus,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Users,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Skeleton, ErrorState, EmptyState } from '@/components/States';
import { InfoBanner } from '@/components/InfoBanner';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { useAppealsData, type Appeal, type AppealStatus } from '../hooks';

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

const statusCfg: Record<
  AppealStatus,
  { label: string; bg: string; icon: typeof Clock; step: number }
> = {
  submitted:    { label: '접수',    bg: K.secondary, icon: Clock,         step: 0 },
  under_review: { label: '검토중',  bg: '#f57800',   icon: AlertCircle,   step: 1 },
  answered:     { label: '답변완료', bg: K.tertiary,  icon: CheckCircle2,  step: 2 },
  closed:       { label: '처리완료', bg: K.primary,   icon: CheckCircle2,  step: 3 },
};

// 상태 타임라인 단계 정의
const TIMELINE_STEPS = [
  { key: 'submitted',    label: '접수',       sub: '이의제기 신청' },
  { key: 'under_review', label: '검토중',     sub: '부서장 검토' },
  { key: 'answered',     label: '부서장 답변', sub: '답변 등록 완료' },
  { key: 'closed',       label: '최종 처리',   sub: 'HR 결정 완료' },
];

const FILTERS: { key: 'all' | AppealStatus; label: string }[] = [
  { key: 'all',          label: '전체'   },
  { key: 'submitted',    label: '접수'   },
  { key: 'under_review', label: '검토중' },
  { key: 'answered',     label: '답변완료' },
  { key: 'closed',       label: '처리완료' },
];

export function AppealsView() {
  return (
    <Suspense fallback={
      <PageContainer>
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </PageContainer>
    }>
      <AppealsInner />
    </Suspense>
  );
}

function AppealsInner() {
  const { user } = useAuth();
  const toast = useToast();
  const searchParams = useSearchParams();
  const resultId = searchParams.get('resultId');

  const { items: appeals, loading, error, reload, create, respond: respondCmd, decide: decideCmd } =
    useAppealsData(!!user);

  const isLeaderOrHr =
    !!user &&
    (user.role === 'team_lead' ||
      user.role === 'division_head' ||
      user.role === 'hr_admin');
  const isHr = user?.role === 'hr_admin';

  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | AppealStatus>('all');
  const [responseDraft, setResponseDraft] = useState<Record<string, string>>({});
  const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null);

  const filtered = useMemo(
    () => appeals.filter((a) => filter === 'all' || a.status === filter),
    [appeals, filter],
  );
  const sel = appeals.find((a) => a.id === selected) ?? null;

  function validateReason(): boolean {
    if (!reason.trim()) {
      setReasonError('이의제기 사유를 입력해 주세요.');
      return false;
    }
    if (reason.trim().length < 10) {
      setReasonError('최소 10자 이상 입력해 주세요.');
      return false;
    }
    setReasonError('');
    return true;
  }

  async function submitAppeal() {
    if (!resultId) return;
    if (!validateReason()) return;
    setBusy(true);
    try {
      await create({ resultId, reason: reason.trim() });
      toast.show({ variant: 'success', message: '이의제기를 신청했어요.' });
      setReason('');
      setReasonError('');
      reload();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.code === 'APPEAL_WINDOW_CLOSED'
          ? '신청 기간(7일)이 지났어요.'
          : err instanceof ApiError
            ? err.message
            : '신청에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setBusy(false);
    }
  }

  async function respond(id: string) {
    const text = (responseDraft[id] ?? '').trim();
    if (!text) return;
    setBusy(true);
    try {
      await respondCmd(id, text);
      toast.show({ variant: 'success', message: '답변을 등록했어요.' });
      setResponseDraft((p) => ({ ...p, [id]: '' }));
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '답변에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string) {
    const text = (responseDraft[id] ?? '').trim();
    if (!text) return;
    setBusy(true);
    try {
      await decideCmd(id, text);
      toast.show({ variant: 'success', message: '최종 결정을 등록했어요.' });
      setResponseDraft((p) => ({ ...p, [id]: '' }));
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '결정에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading && appeals.length === 0) return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </PageContainer>
  );
  if (error) return <ErrorState onRetry={reload} />;

  const stats = [
    { label: '전체',       value: appeals.length,                                                      color: K.primary,   Icon: Users         },
    { label: '접수/검토중', value: appeals.filter((a) => a.status === 'submitted' || a.status === 'under_review').length, color: '#f57800', Icon: AlertCircle   },
    { label: '답변완료',   value: appeals.filter((a) => a.status === 'answered').length,                color: K.tertiary,  Icon: MessageSquare },
    { label: '처리완료',   value: appeals.filter((a) => a.status === 'closed').length,                  color: K.secondary, Icon: CheckCircle2  },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="이의제기"
        subtitle="등급 통보 후 7일 이내에 평가 결과에 대한 이의제기를 신청하고 처리합니다."
      />

      {/* 요약 카드 — §3-1 대형 수치 스케일 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {stats.map((s) => (
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

      {/* 이의제기 신청 폼 (결과에서 진입 시) */}
      {resultId && (
        <div
          className="bg-white p-6"
          style={{ border: '1px solid rgba(202,196,210,0.5)', borderRadius: 12, boxShadow: CARD_SHADOW }}
        >
          <div className="flex items-center gap-2 mb-4">
            <MessageSquareWarning size={16} color={K.secondary} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: K.onSurface }}>이의제기 신청</h3>
          </div>
          <InfoBanner tone="info" title="신청 전 확인사항">
            등급 통보일로부터 7일 이내에 신청 가능해요. 이의제기 사유를 구체적으로 작성할수록 검토에 도움이 돼요.
          </InfoBanner>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7684', display: 'block', marginBottom: 5 }}>
              이의제기 사유 <span style={{ color: '#f04452', marginLeft: 3 }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (reasonError) setReasonError(''); }}
              placeholder="평가 결과에 동의하지 않는 구체적인 사유를 작성해 주세요."
              className="w-full resize-none outline-none"
              style={{
                fontSize: 13,
                minHeight: 100,
                border: `1px solid ${reasonError ? '#f04452' : K.outline}`,
                borderRadius: 8,
                padding: '10px 12px',
                color: K.onSurface,
                background: K.surfaceLow,
                transition: 'border-color .12s, box-shadow .12s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = reasonError ? '#f04452' : K.secondary;
                e.currentTarget.style.boxShadow = `0 0 0 3px rgba(0,84,202,0.10)`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = reasonError ? '#f04452' : K.outline;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            {reasonError && (
              <p style={{ fontSize: 11, color: '#f04452', marginTop: 3 }}>{reasonError}</p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span style={{ fontSize: 11.5, color: K.onSurfaceVariant }}>
              {reason.length}자 입력
            </span>
            <button
              disabled={!reason.trim() || busy}
              onClick={() => void submitAppeal()}
              className="flex items-center gap-1.5 px-5 py-2.5 text-white disabled:opacity-50"
              style={{
                fontSize: 13, fontWeight: 600,
                background: K.secondary,
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,84,202,0.25)',
              }}
            >
              <Plus size={14} /> {busy ? '신청 중…' : '이의제기 신청'}
            </button>
          </div>
        </div>
      )}

      {/* 필터 탭 */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const cnt = f.key === 'all' ? appeals.length : appeals.filter((a) => a.status === f.key).length;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="transition-all"
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                background: active ? K.primary : K.white,
                color: active ? '#fff' : K.onSurfaceVariant,
                border: `1px solid ${active ? K.primary : K.outline}`,
                borderRadius: 999,
              }}
            >
              {f.label}
              {cnt > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10.5,
                    fontWeight: 700,
                    background: active ? 'rgba(255,255,255,0.25)' : K.surfaceLow,
                    color: active ? '#fff' : K.onSurfaceVariant,
                    padding: '0px 5px',
                    borderRadius: 999,
                  }}
                >
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 목록 + 상세 */}
      {filtered.length === 0 ? (
        <EmptyState
          title="이의제기 내역이 없어요."
          description={
            filter === 'all'
              ? '아직 등록된 이의제기가 없어요.'
              : `${FILTERS.find((f) => f.key === filter)?.label ?? ''} 상태의 이의제기가 없어요.`
          }
          action={
            filter !== 'all' ? (
              <button
                onClick={() => setFilter('all')}
                style={{
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: K.secondary,
                  border: `1px solid ${K.secondary}`,
                  borderRadius: 8,
                  background: K.white,
                  cursor: 'pointer',
                }}
              >
                전체 보기
              </button>
            ) : undefined
          }
        />
      ) : (
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: sel ? '1fr 420px' : '1fr' }}
        >
          {/* 이의제기 목록 */}
          <div className="space-y-3">
            {filtered.map((appeal) => {
              const sc = statusCfg[appeal.status];
              const isSelected = selected === appeal.id;
              const isTimelineOpen = expandedTimeline === appeal.id;
              const currentStep = sc.step;

              return (
                <div
                  key={appeal.id}
                  className="cursor-pointer bg-white transition-all"
                  style={{
                    border: `1px solid ${isSelected ? K.primary : 'rgba(202,196,210,0.5)'}`,
                    borderRadius: 12,
                    boxShadow: isSelected ? `0 0 0 2px rgba(63,44,128,0.15), ${CARD_SHADOW}` : CARD_SHADOW,
                    borderLeft: isSelected ? `3px solid ${K.primary}` : `3px solid transparent`,
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(63,44,128,0.25)'; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(202,196,210,0.5)'; }}
                >
                  {/* 카드 헤더 — 클릭으로 상세 선택 */}
                  <div
                    className="flex items-start gap-4 p-4"
                    onClick={() => setSelected(isSelected ? null : appeal.id)}
                  >
                    <div
                      className="flex-shrink-0 flex h-10 w-10 items-center justify-center"
                      style={{ background: 'rgba(186,26,26,0.08)', borderRadius: 8 }}
                    >
                      <MessageSquareWarning size={18} color='#ba1a1a' />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2 flex-wrap">
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: K.onSurface }}>
                          {appeal.userName ?? appeal.userId.slice(0, 8)} 님의 이의제기
                        </span>
                        <div className="ml-auto flex flex-shrink-0 items-center gap-1.5">
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              background: sc.bg,
                              color: '#fff',
                              padding: '2px 10px',
                              borderRadius: 999,
                            }}
                          >
                            {sc.label}
                          </span>
                        </div>
                      </div>
                      <p className="line-clamp-2" style={{ fontSize: 12.5, color: K.onSurfaceVariant, lineHeight: 1.5 }}>
                        {appeal.reason}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                        {appeal.departmentName && (
                          <span style={{ fontSize: 11.5, color: K.onSurfaceVariant }}>{appeal.departmentName}</span>
                        )}
                        <span style={{ fontSize: 11.5, color: K.onSurfaceVariant }}>· {appeal.createdAt.slice(0, 10)}</span>
                        {/* 타임라인 토글 버튼 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedTimeline(isTimelineOpen ? null : appeal.id);
                          }}
                          className="ml-auto flex items-center gap-1"
                          style={{ fontSize: 11, color: K.secondary, fontWeight: 600 }}
                        >
                          처리 단계
                          {isTimelineOpen
                            ? <ChevronDown size={12} />
                            : <ChevronRight size={12} />
                          }
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 상태 타임라인 — 펼침 */}
                  {isTimelineOpen && (
                    <div
                      className="px-4 pb-4"
                      style={{ borderTop: `1px solid #e7e8ec` }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start gap-0 pt-3">
                        {TIMELINE_STEPS.map((step, idx) => {
                          const isDone = currentStep > idx;
                          const isActive = currentStep === idx;
                          const stepColor = isDone ? K.tertiary : isActive ? sc.bg : K.outline;
                          const isLast = idx === TIMELINE_STEPS.length - 1;
                          return (
                            <div key={step.key} className="flex-1 relative">
                              {/* 연결선 */}
                              {!isLast && (
                                <div
                                  className="absolute top-3.5 left-1/2 right-0"
                                  style={{ height: 2, background: isDone ? K.tertiary : '#e7e8ec', zIndex: 0 }}
                                />
                              )}
                              <div className="flex flex-col items-center relative z-10">
                                {/* 단계 원 */}
                                <div
                                  style={{
                                    width: 28, height: 28, borderRadius: '50%',
                                    background: isDone ? K.tertiary : isActive ? sc.bg : '#f2f3f7',
                                    border: `2px solid ${stepColor}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  {isDone
                                    ? <Check size={13} color="#fff" strokeWidth={2.5} />
                                    : isActive
                                      ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.bg }} />
                                      : <div style={{ width: 8, height: 8, borderRadius: '50%', background: K.outline }} />
                                  }
                                </div>
                                <div className="mt-1.5 text-center" style={{ maxWidth: 72 }}>
                                  <div style={{ fontSize: 10.5, fontWeight: 700, color: isDone || isActive ? K.onSurface : K.onSurfaceVariant }}>
                                    {step.label}
                                  </div>
                                  <div style={{ fontSize: 10, color: K.onSurfaceVariant, marginTop: 1 }}>
                                    {step.sub}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 상세 패널 */}
          {sel && (
            <div
              className="overflow-hidden bg-white"
              style={{ border: '1px solid rgba(202,196,210,0.5)', borderRadius: 12, alignSelf: 'start', boxShadow: CARD_SHADOW }}
            >
              {/* 패널 헤더 */}
              <div
                className="px-5 py-4 border-b flex items-center gap-2"
                style={{ background: K.surfaceLow, borderColor: '#e7e8ec' }}
              >
                <MessageSquareWarning size={15} color={K.secondary} />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: K.onSurface }}>이의제기 상세</h3>
                <div className="ml-auto">
                  {(() => {
                    const sc = statusCfg[sel.status];
                    return (
                      <span style={{ fontSize: 11, fontWeight: 600, background: sc.bg, color: '#fff', padding: '2px 10px', borderRadius: 999 }}>
                        {sc.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* 처리 타임라인 (상세 패널 내) */}
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-start">
                  {TIMELINE_STEPS.map((step, idx) => {
                    const currentStep = statusCfg[sel.status].step;
                    const isDone = currentStep > idx;
                    const isActive = currentStep === idx;
                    const stepColor = isDone ? K.tertiary : isActive ? statusCfg[sel.status].bg : K.outline;
                    const isLast = idx === TIMELINE_STEPS.length - 1;
                    return (
                      <div key={step.key} className="flex-1 relative">
                        {!isLast && (
                          <div
                            className="absolute top-3.5 left-1/2 right-0"
                            style={{ height: 2, background: isDone ? K.tertiary : '#e7e8ec', zIndex: 0 }}
                          />
                        )}
                        <div className="flex flex-col items-center relative z-10">
                          <div
                            style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: isDone ? K.tertiary : isActive ? statusCfg[sel.status].bg : '#f2f3f7',
                              border: `2px solid ${stepColor}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            {isDone
                              ? <Check size={13} color="#fff" strokeWidth={2.5} />
                              : isActive
                                ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusCfg[sel.status].bg }} />
                                : <div style={{ width: 8, height: 8, borderRadius: '50%', background: K.outline }} />
                            }
                          </div>
                          <div className="mt-1 text-center" style={{ maxWidth: 64 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: isDone || isActive ? K.onSurface : K.onSurfaceVariant }}>
                              {step.label}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 px-5 pb-5 pt-3">
                {/* 구분선 */}
                <div style={{ height: 1, background: '#e7e8ec' }} />

                <DetailRow label="신청자" value={`${sel.userName ?? sel.userId.slice(0, 8)}${sel.departmentName ? ` (${sel.departmentName})` : ''}`} />
                <DetailRow label="접수일" value={new Date(sel.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} />

                {/* ① 신청 사유 */}
                <ContentBlock
                  step="①"
                  label="신청 사유"
                  color={K.secondary}
                  bg="rgba(0,84,202,0.04)"
                >
                  {sel.reason}
                </ContentBlock>

                {/* ② 부서장 답변 */}
                {sel.response ? (
                  <ContentBlock
                    step="②"
                    label="부서장 답변"
                    color={K.tertiary}
                    bg="rgba(14,154,160,0.04)"
                  >
                    {sel.response}
                  </ContentBlock>
                ) : (isLeaderOrHr && sel.status === 'answered') ? null : (
                  <div
                    className="px-4 py-3 rounded-lg"
                    style={{ background: K.surfaceLow, border: `1px dashed ${K.outlineDim}` }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: K.onSurfaceVariant, marginBottom: 2 }}>② 부서장 답변</div>
                    <p style={{ fontSize: 12.5, color: K.onSurfaceVariant }}>아직 답변이 등록되지 않았어요.</p>
                  </div>
                )}

                {/* ③ HR 최종 결정 */}
                {sel.decision ? (
                  <ContentBlock
                    step="③"
                    label="HR 최종 결정"
                    color={K.primary}
                    bg="rgba(63,44,128,0.04)"
                  >
                    {sel.decision}
                  </ContentBlock>
                ) : sel.status !== 'closed' ? (
                  <div
                    className="px-4 py-3 rounded-lg"
                    style={{ background: K.surfaceLow, border: `1px dashed ${K.outlineDim}` }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: K.onSurfaceVariant, marginBottom: 2 }}>③ HR 최종 결정</div>
                    <p style={{ fontSize: 12.5, color: K.onSurfaceVariant }}>아직 결정이 등록되지 않았어요.</p>
                  </div>
                ) : null}

                {/* 부서장 답변 작성 */}
                {isLeaderOrHr && (sel.status === 'submitted' || sel.status === 'under_review') && (
                  <div className="space-y-3 pt-2" style={{ borderTop: '1px solid #e7e8ec' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: K.onSurface }}>부서장 답변 작성</div>
                    <textarea
                      value={responseDraft[sel.id] ?? ''}
                      onChange={(e) => setResponseDraft((p) => ({ ...p, [sel.id]: e.target.value }))}
                      placeholder="이의제기에 대한 처리 의견을 입력하세요."
                      className="w-full resize-none outline-none"
                      style={{
                        fontSize: 12.5,
                        minHeight: 80,
                        border: `1px solid ${K.outline}`,
                        borderRadius: 8,
                        padding: '9px 11px',
                        color: K.onSurface,
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
                    <button
                      disabled={!(responseDraft[sel.id] ?? '').trim() || busy}
                      onClick={() => void respond(sel.id)}
                      className="w-full py-2.5 text-white disabled:opacity-50 transition-opacity"
                      style={{
                        fontSize: 13, fontWeight: 600,
                        background: K.secondary,
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0,84,202,0.20)',
                      }}
                    >
                      {busy ? '등록 중…' : '답변 등록'}
                    </button>
                  </div>
                )}

                {/* HR 최종 결정 작성 */}
                {isHr && sel.status === 'answered' && (
                  <div className="space-y-3 pt-2" style={{ borderTop: '1px solid #e7e8ec' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: K.onSurface }}>최종 결정 (유지/조정 + 사유)</div>
                    <InfoBanner tone="warning">
                      최종 결정 후에는 이의제기가 종료됩니다. 신중하게 작성해 주세요.
                    </InfoBanner>
                    <textarea
                      value={responseDraft[sel.id] ?? ''}
                      onChange={(e) => setResponseDraft((p) => ({ ...p, [sel.id]: e.target.value }))}
                      placeholder="최종 결정 사유를 입력하세요. (예: 평가 결과 유지 — 제출 근거 확인 결과 타당성 인정)"
                      className="w-full resize-none outline-none"
                      style={{
                        fontSize: 12.5,
                        minHeight: 80,
                        border: `1px solid ${K.outline}`,
                        borderRadius: 8,
                        padding: '9px 11px',
                        color: K.onSurface,
                        background: K.surfaceLow,
                        transition: 'border-color .12s, box-shadow .12s',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = K.tertiary;
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,154,160,0.12)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = K.outline;
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    <button
                      disabled={!(responseDraft[sel.id] ?? '').trim() || busy}
                      onClick={() => void decide(sel.id)}
                      className="w-full py-2.5 text-white disabled:opacity-50 transition-opacity"
                      style={{
                        fontSize: 13, fontWeight: 600,
                        background: K.tertiary,
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(14,154,160,0.20)',
                      }}
                    >
                      {busy ? '등록 중…' : '최종 결정 등록'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}

// ── 서브 컴포넌트 ───────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#797582', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#191c1f' }}>{value}</div>
    </div>
  );
}

function ContentBlock({
  step,
  label,
  color,
  bg,
  children,
}: {
  step: string;
  label: string;
  color: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="px-4 py-3 rounded-lg"
      style={{ background: bg, border: `1px solid ${color}30` }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span
          style={{
            fontSize: 10.5, fontWeight: 800, color: '#fff',
            background: color, padding: '1px 7px', borderRadius: 4,
          }}
        >
          {step}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
      </div>
      <p className="whitespace-pre-wrap" style={{ fontSize: 12.5, color: '#191c1f', lineHeight: 1.6 }}>
        {children}
      </p>
    </div>
  );
}
