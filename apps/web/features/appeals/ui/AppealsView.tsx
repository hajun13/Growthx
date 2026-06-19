'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  MessageSquareWarning,
  Plus,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Check,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Skeleton, ErrorState, EmptyState } from '@/components/States';
import { InfoBanner } from '@/components/InfoBanner';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

import { FilterChipBar } from '@/components/FilterChipBar';
import { StatusBadge } from '@/components/StatusBadge';
import { Textarea } from '@/components/ui/textarea';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { useAppealsData, type Appeal, type AppealStatus } from '../hooks';

// 상태 타임라인 단계 정의
const TIMELINE_STEPS = [
  { key: 'submitted',    label: '접수',       sub: '이의제기 신청' },
  { key: 'under_review', label: '검토중',     sub: '부서장 검토' },
  { key: 'answered',     label: '부서장 답변', sub: '답변 등록 완료' },
  { key: 'closed',       label: '최종 처리',   sub: 'HR 결정 완료' },
];

const STATUS_STEP: Record<AppealStatus, number> = {
  submitted:    0,
  under_review: 1,
  answered:     2,
  closed:       3,
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',          label: '전체'    },
  { value: 'submitted',    label: '접수'    },
  { value: 'under_review', label: '검토중'  },
  { value: 'answered',     label: '답변완료' },
  { value: 'closed',       label: '처리완료' },
];

export function AppealsView() {
  return (
    <Suspense fallback={
      <PageContainer>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
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
  const [filter, setFilter] = useState<string>('all');
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
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </PageContainer>
  );
  if (error) return <ErrorState onRetry={reload} />;

  const filterWithCount = FILTER_OPTIONS.map((f) => ({
    ...f,
    count: f.value === 'all'
      ? appeals.length
      : appeals.filter((a) => a.status === f.value).length,
  }));

  const pendingCount = appeals.filter((a) => a.status === 'submitted' || a.status === 'under_review').length;

  return (
    <PageContainer>
      <PageHeader
        title="이의제기"
        subtitle="등급 통보 후 7일 이내에 평가 결과에 대한 이의제기를 신청하고 처리합니다."
        right={
          <HeaderMetrics
            items={[
              { label: '전체', value: appeals.length },
              {
                label: '접수/검토중',
                value: pendingCount,
                accent: pendingCount > 0 ? 'text-warning-600' : undefined,
              },
              { label: '답변완료', value: appeals.filter((a) => a.status === 'answered').length },
              { label: '처리완료', value: appeals.filter((a) => a.status === 'closed').length },
            ]}
          />
        }
      />

      {/* 이의제기 신청 폼 (결과에서 진입 시) */}
      {resultId && (
        <Card title="이의제기 신청">
          <div className="space-y-4">
            <InfoBanner tone="info" title="신청 전 확인사항">
              등급 통보일로부터 7일 이내에 신청 가능해요. 이의제기 사유를 구체적으로 작성할수록 검토에 도움이 돼요.
            </InfoBanner>
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                이의제기 사유 <span className="text-danger-500 ml-0.5">*</span>
              </label>
              <Textarea
                value={reason}
                onChange={(e) => { setReason(e.target.value); if (reasonError) setReasonError(''); }}
                placeholder="평가 결과에 동의하지 않는 구체적인 사유를 작성해 주세요."
                className={reasonError ? 'border-danger-500 focus-visible:border-danger-500' : ''}
                rows={4}
              />
              {reasonError && (
                <p className="mt-1.5 text-[11px] text-danger-600">{reasonError}</p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] text-muted-foreground tabular-nums">{reason.length}자 입력</span>
              <Button
                variant="primary"
                size="sm"
                disabled={!reason.trim() || busy}
                loading={busy}
                leftIcon={<Plus size={14} aria-hidden />}
                onClick={() => void submitAppeal()}
              >
                이의제기 신청
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 필터 칩 */}
      <section className="gx-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <FilterChipBar
          options={filterWithCount}
          value={filter}
          onChange={setFilter}
        />
        <span className="text-[12px] font-medium text-muted-foreground">
          {filtered.length}건 표시
        </span>
      </section>

      {/* 목록 + 상세 */}
      {filtered.length === 0 ? (
        <EmptyState
          title="이의제기 내역이 없어요."
          description={
            filter === 'all'
              ? '아직 등록된 이의제기가 없어요.'
              : `${FILTER_OPTIONS.find((f) => f.value === filter)?.label ?? ''} 상태의 이의제기가 없어요.`
          }
          action={
            filter !== 'all' ? (
              <Button variant="secondary" onClick={() => setFilter('all')}>
                전체 보기
              </Button>
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
              const currentStep = STATUS_STEP[appeal.status];
              const isSelected = selected === appeal.id;
              const isTimelineOpen = expandedTimeline === appeal.id;

              return (
                <div
                  key={appeal.id}
                  className={[
                  'cursor-pointer bg-card rounded-lg border transition-all',
                    isSelected
                      ? 'border-primary border-l-[3px] shadow-elev-2'
                      : 'border-border border-l-[3px] border-l-transparent hover:border-primary/25',
                  ].join(' ')}
                >
                  {/* 카드 헤더 */}
                  <div
                    className="flex items-start gap-4 p-4"
                    onClick={() => setSelected(isSelected ? null : appeal.id)}
                  >
                    <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-danger-50">
                      <MessageSquareWarning size={18} className="text-danger-500" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-bold text-foreground">
                          {appeal.userName ?? appeal.userId.slice(0, 8)} 님의 이의제기
                        </span>
                        <div className="ml-auto flex-shrink-0">
                          <StatusBadge status={appeal.status} />
                        </div>
                      </div>
                      <p className="line-clamp-2 text-[12.5px] text-muted-foreground leading-relaxed">
                        {appeal.reason}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                        {appeal.departmentName && (
                          <span className="text-[11.5px] text-muted-foreground">{appeal.departmentName}</span>
                        )}
                        <span className="text-[11.5px] text-muted-foreground tabular-nums">
                          · {appeal.createdAt.slice(0, 10)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto text-[11px] h-auto py-0.5 px-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedTimeline(isTimelineOpen ? null : appeal.id);
                          }}
                        >
                          처리 단계
                          {isTimelineOpen
                            ? <ChevronDown size={12} className="ml-0.5" aria-hidden />
                            : <ChevronRight size={12} className="ml-0.5" aria-hidden />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* 상태 타임라인 — 펼침 */}
                  {isTimelineOpen && (
                    <div
                      className="px-4 pb-4 border-t border-border"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <AppealTimeline currentStep={currentStep} compact />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 상세 패널 */}
          {sel && (
            <Card padding="sm" className="self-start">
              {/* 패널 헤더 */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted rounded-t-lg">
                <MessageSquareWarning size={15} className="text-primary" aria-hidden />
                <h3 className="text-[14px] font-bold text-foreground">이의제기 상세</h3>
                <div className="ml-auto">
                  <StatusBadge status={sel.status} />
                </div>
              </div>

              {/* 처리 타임라인 */}
              <div className="px-4 pt-4 pb-2">
                <AppealTimeline currentStep={STATUS_STEP[sel.status]} />
              </div>

              <div className="space-y-4 px-4 pb-4 pt-3">
                <div className="h-px bg-border" />

                <DetailRow label="신청자" value={`${sel.userName ?? sel.userId.slice(0, 8)}${sel.departmentName ? ` (${sel.departmentName})` : ''}`} />
                <DetailRow label="접수일" value={new Date(sel.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} />

                {/* 신청 사유 */}
                <ContentBlock step="①" label="신청 사유" tone="primary">
                  {sel.reason}
                </ContentBlock>

                {/* 부서장 답변 */}
                {sel.response ? (
                  <ContentBlock step="②" label="부서장 답변" tone="info">
                    {sel.response}
                  </ContentBlock>
                ) : (isLeaderOrHr && sel.status === 'answered') ? null : (
                  <div className="px-4 py-3 rounded-lg bg-muted border border-dashed border-border">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1">② 부서장 답변</div>
                    <p className="text-[12.5px] text-muted-foreground">아직 답변이 등록되지 않았어요.</p>
                  </div>
                )}

                {/* HR 최종 결정 */}
                {sel.decision ? (
                  <ContentBlock step="③" label="HR 최종 결정" tone="success">
                    {sel.decision}
                  </ContentBlock>
                ) : sel.status !== 'closed' ? (
                  <div className="px-4 py-3 rounded-lg bg-muted border border-dashed border-border">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1">③ HR 최종 결정</div>
                    <p className="text-[12.5px] text-muted-foreground">아직 결정이 등록되지 않았어요.</p>
                  </div>
                ) : null}

                {/* 부서장 답변 작성 */}
                {isLeaderOrHr && (sel.status === 'submitted' || sel.status === 'under_review') && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="text-[12.5px] font-bold text-foreground">부서장 답변 작성</div>
                    <Textarea
                      value={responseDraft[sel.id] ?? ''}
                      onChange={(e) => setResponseDraft((p) => ({ ...p, [sel.id]: e.target.value }))}
                      placeholder="이의제기에 대한 처리 의견을 입력하세요."
                      rows={3}
                    />
                    <Button
                      variant="primary"
                      className="w-full"
                      disabled={!(responseDraft[sel.id] ?? '').trim() || busy}
                      loading={busy}
                      onClick={() => void respond(sel.id)}
                    >
                      답변 등록
                    </Button>
                  </div>
                )}

                {/* HR 최종 결정 작성 */}
                {isHr && sel.status === 'answered' && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="text-[12.5px] font-bold text-foreground">최종 결정 (유지/조정 + 사유)</div>
                    <InfoBanner tone="warning">
                      최종 결정 후에는 이의제기가 종료됩니다. 신중하게 작성해 주세요.
                    </InfoBanner>
                    <Textarea
                      value={responseDraft[sel.id] ?? ''}
                      onChange={(e) => setResponseDraft((p) => ({ ...p, [sel.id]: e.target.value }))}
                      placeholder="최종 결정 사유를 입력하세요. (예: 평가 결과 유지 — 제출 근거 확인 결과 타당성 인정)"
                      rows={3}
                    />
                    <Button
                      variant="primary"
                      className="w-full"
                      disabled={!(responseDraft[sel.id] ?? '').trim() || busy}
                      loading={busy}
                      onClick={() => void decide(sel.id)}
                    >
                      최종 결정 등록
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────

function AppealTimeline({ currentStep, compact = false }: { currentStep: number; compact?: boolean }) {
  return (
    <div className={`flex items-start ${compact ? 'pt-3' : ''}`}>
      {TIMELINE_STEPS.map((step, idx) => {
        const isDone = currentStep > idx;
        const isActive = currentStep === idx;
        const isLast = idx === TIMELINE_STEPS.length - 1;
        return (
          <div key={step.key} className="flex-1 relative">
            {!isLast && (
              <div
                className={`absolute top-3.5 left-1/2 right-0 h-0.5 z-0 ${isDone ? 'bg-info-500' : 'bg-border'}`}
              />
            )}
            <div className="flex flex-col items-center relative z-10">
              <div
                className={[
                  'flex items-center justify-center rounded-lg border-2',
                  'w-7 h-7',
                  isDone
                    ? 'bg-info-500 border-info-500'
                    : isActive
                      ? 'bg-primary border-primary'
                      : 'bg-muted border-border',
                ].join(' ')}
              >
                {isDone ? (
                  <Check size={13} className="text-white" strokeWidth={2.5} aria-hidden />
                ) : isActive ? (
                  <div className="h-2 w-2 rounded-[3px] bg-white" />
                ) : (
                  <div className="h-2 w-2 rounded-[3px] bg-border" />
                )}
              </div>
              <div className={`mt-1.5 text-center ${compact ? 'max-w-[72px]' : 'max-w-[64px]'}`}>
                <div className={`font-bold ${compact ? 'text-[10.5px]' : 'text-[10px]'} ${isDone || isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </div>
                {compact && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">{step.sub}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
        {label}
      </div>
      <div className="text-[13px] font-semibold text-foreground">{value}</div>
    </div>
  );
}

type ContentBlockTone = 'primary' | 'info' | 'success';

const toneBorder: Record<ContentBlockTone, string> = {
  primary: 'border-primary/20 bg-primary/[0.04]',
  info:    'border-info-500/20 bg-info-50',
  success: 'border-success-500/20 bg-success-50',
};

const toneLabel: Record<ContentBlockTone, string> = {
  primary: 'bg-primary text-white',
  info:    'bg-info-500 text-white',
  success: 'bg-success-500 text-white',
};

const toneLabelText: Record<ContentBlockTone, string> = {
  primary: 'text-primary',
  info:    'text-info-700',
  success: 'text-success-700',
};

function ContentBlock({
  step,
  label,
  tone,
  children,
}: {
  step: string;
  label: string;
  tone: ContentBlockTone;
  children: React.ReactNode;
}) {
  return (
    <div className={`px-4 py-3 rounded-lg border ${toneBorder[tone]}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`text-[10.5px] font-extrabold px-1.5 py-0.5 rounded ${toneLabel[tone]}`}>
          {step}
        </span>
        <span className={`text-[12px] font-bold ${toneLabelText[tone]}`}>{label}</span>
      </div>
      <p className="whitespace-pre-wrap text-[12.5px] text-foreground leading-relaxed">
        {children}
      </p>
    </div>
  );
}
