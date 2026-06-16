'use client';

// 본인(employee/부서장 본인) "내 점검" 탭 — 섹션 탭 구조.
//  - 섹션 탭 3개: KPI 자가점검 / 부서장 피드백 / 보완조치·재조정
//  - '종합 코멘트' 탭 제거 → 상반기 총평 textarea를 KPI 자가점검 탭 하단으로 통합.
//  - 폼 상태 보존: 전 섹션 마운트 유지 + display:none 토글 (탭 전환 시 입력 보존).
//  - submitSelf/actionItem/rebaseline 로직·데이터 shape 불변.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Send } from 'lucide-react';
import {
  useMidtermProgress,
  useMidtermReviews,
  useActionItems,
  midtermReviewCommands,
  actionItemCommands,
} from '../hooks';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { ActionItemRow } from '@/components/ActionItemRow';
import { EmptyState, Skeleton } from '@/components/States';
import { InfoBanner } from '@/components/InfoBanner';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Tabs } from '@/components/Tabs';
import { cn } from '@/lib/utils';
import { RebaselineRequestSection } from './RebaselineRequestSection';
import { KpiCheckInCard, defaultCheckIn } from './KpiCheckInCard';
import type { CheckInInput } from './KpiCheckInCard';
import type {
  User,
  ActionItem,
  ActionItemStatus,
  KpiProgress,
  Grade,
} from '@/lib/types';

// 그룹별 섹션 색(본인평가·KPI 페이지와 동일).
const GROUP_CFG: Record<string, { label: string; accent: string }> = {
  performance_core: { label: '성과중심 지표', accent: 'bg-primary' },
  collaboration_growth: { label: '협업·성장 지표', accent: 'bg-success-500' },
};
const GROUP_ORDER = ['performance_core', 'collaboration_growth'] as const;

// ── 섹션 탭 (3개) ──
type SectionTab = 'checkin' | 'feedback' | 'actions';

const SECTION_TAB_ITEMS: { key: SectionTab; label: string }[] = [
  { key: 'checkin', label: 'KPI 자가점검' },
  { key: 'feedback', label: '부서장 피드백' },
  { key: 'actions', label: '보완조치·재조정' },
];

// 탭 도트 상태
type DotStatus = 'done' | 'todo' | 'none';

export function EmployeeMidterm({
  cycleId,
  user,
  readOnly,
}: {
  cycleId: string;
  user: User;
  readOnly: boolean;
}) {
  const toast = useToast();
  const { current } = useCurrentCycle();

  const { data: progress, loading: progLoading } = useMidtermProgress({
    cycleId,
    userId: user.id,
  });
  const {
    data: reviews,
    loading: revLoading,
    reload: reloadReviews,
  } = useMidtermReviews({ cycleId, evaluateeId: user.id });
  const {
    data: actionData,
    loading: actionLoading,
    reload: reloadActions,
  } = useActionItems({ cycleId, assigneeId: user.id });

  const myReview = useMemo(
    () => reviews?.data.find((r) => r.evaluateeId === user.id) ?? null,
    [reviews, user.id],
  );
  const selfDone = myReview?.status === 'self_done' || myReview?.status === 'confirmed';
  const confirmed = myReview?.status === 'confirmed';

  const kpis = progress?.kpis ?? [];
  const myItems: ActionItem[] = actionData?.data ?? [];

  const [checkIns, setCheckIns] = useState<Record<string, CheckInInput>>({});
  const [selfNote, setSelfNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [rebaselineOpen, setRebaselineOpen] = useState(false);
  const [sectionTab, setSectionTab] = useState<SectionTab>('checkin');

  useEffect(() => {
    setSelfNote(myReview?.selfNote ?? '');
  }, [myReview?.id, myReview?.selfNote]);

  useEffect(() => {
    if (kpis.length === 0) return;
    setCheckIns((prev) => {
      const next = { ...prev };
      for (const kpi of kpis) {
        if (!next[kpi.kpiId]) {
          next[kpi.kpiId] = defaultCheckIn(kpi);
        }
      }
      return next;
    });
  }, [kpis]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateCheckIn(kpiId: string, patch: Partial<CheckInInput>) {
    setCheckIns((prev) => ({ ...prev, [kpiId]: { ...prev[kpiId], ...patch } }));
  }

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const kpiCheckIns = kpis
        .map((kpi) => {
          const ci = checkIns[kpi.kpiId];
          if (!ci) return null;
          const entry: {
            kpiId: string;
            selfActualText?: string;
            selfActualValue?: number;
            selfNote?: string;
            selfGrade?: Grade;
          } = { kpiId: kpi.kpiId };
          if (ci.selfActualText.trim()) entry.selfActualText = ci.selfActualText.trim();
          const parsed = parseFloat(ci.selfActualValue);
          if (!isNaN(parsed)) entry.selfActualValue = parsed;
          if (ci.selfNote.trim()) entry.selfNote = ci.selfNote.trim();
          if (ci.selfGrade) entry.selfGrade = ci.selfGrade as Grade;
          return entry;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      await midtermReviewCommands.submitSelf({
        cycleId,
        selfNote: selfNote.trim() || undefined,
        kpiCheckIns,
      });
      toast.show({ variant: 'success', message: '자가점검을 제출했어요.' });
      reloadReviews();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '제출에 실패했어요.',
      });
    } finally {
      setSubmitting(false);
    }
  }, [cycleId, kpis, checkIns, selfNote, reloadReviews, toast]);

  async function changeStatus(id: string, next: ActionItemStatus, completionNote?: string) {
    setBusyItemId(id);
    try {
      await actionItemCommands.transition(id, { status: next, completionNote });
      toast.show({ variant: 'success', message: '보완 조치 상태를 변경했어요.' });
      reloadActions();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === 'INVALID_STATE_TRANSITION'
            ? '지금 단계에서는 바꿀 수 없는 상태예요.'
            : err.message
          : '상태 변경에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setBusyItemId(null);
    }
  }

  const weightSum = kpis.reduce((s, k) => s + k.weight, 0);

  const byGroup: Partial<Record<string, KpiProgress[]>> = {};
  for (const kpi of kpis) {
    if (!byGroup[kpi.group]) byGroup[kpi.group] = [];
    byGroup[kpi.group]!.push(kpi);
  }

  const isMidReview = current?.status === 'mid_review';
  const canSubmit = !readOnly && !confirmed;

  // 3탭 도트 상태
  const dots: Record<SectionTab, DotStatus> = useMemo(() => {
    const checkinDot: DotStatus = confirmed ? 'done' : selfDone ? 'done' : canSubmit ? 'todo' : 'none';
    const feedbackDot: DotStatus = confirmed ? 'done' : selfDone ? 'todo' : 'none';
    const actionsDot: DotStatus =
      myItems.length > 0
        ? myItems.every((i) => i.status === 'done')
          ? 'done'
          : 'todo'
        : 'none';
    return { checkin: checkinDot, feedback: feedbackDot, actions: actionsDot };
  }, [confirmed, selfDone, canSubmit, myItems]);

  // 초기 자동 포커스 — todo 도트 있는 첫 탭
  useEffect(() => {
    if (!progLoading && !revLoading) {
      const first = (Object.keys(dots) as SectionTab[]).find((k) => dots[k] === 'todo');
      if (first) setSectionTab(first);
    }
  }, [progLoading, revLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (progLoading || revLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (kpis.length === 0) {
    return (
      <EmptyState
        title="자가점검할 KPI가 없어요."
        description="KPI가 확정되면 중간 진척을 점검할 수 있어요."
      />
    );
  }

  const tabItems = SECTION_TAB_ITEMS.map((t) => ({
    key: t.key,
    label: t.label,
  }));

  return (
    <div className="flex flex-col gap-0">
      {/* 제출 상태 안내 */}
      {confirmed && (
        <div className="mb-4">
          <InfoBanner tone="success">
            자가점검 제출 완료
            {myReview?.reviewerName && (
              <span className="ml-1 font-normal">
                — 부서장 {myReview.reviewerName} 확인
                {myReview.confirmedAt
                  ? ` · ${new Date(myReview.confirmedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`
                  : ''}
              </span>
            )}
          </InfoBanner>
        </div>
      )}
      {selfDone && !confirmed && (
        <div className="mb-4">
          <InfoBanner tone="tip">
            자가점검 제출 완료 — 부서장 피드백 대기 중
          </InfoBanner>
        </div>
      )}

      {/* 섹션 탭 바 */}
      <Tabs
        items={tabItems}
        activeKey={sectionTab}
        onChange={(k) => setSectionTab(k as SectionTab)}
      />

      {/* 탭 콘텐츠 — 전부 마운트, display:none 토글로 폼 상태 보존 */}
      <div className="mt-4">

        {/* 탭 1: KPI 자가점검 (+ 상반기 총평 통합) */}
        <div style={{ display: sectionTab === 'checkin' ? 'flex' : 'none', flexDirection: 'column', gap: 24 }}>
          {GROUP_ORDER.map((group) => {
            const rows = byGroup[group];
            if (!rows || rows.length === 0) return null;
            const cfg = GROUP_CFG[group];
            return (
              <div key={group} className="flex flex-col gap-2.5">
                {/* 그룹 섹션 헤더 */}
                <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                  <span className={cn('w-1 h-4 inline-block rounded-sm flex-shrink-0', cfg.accent)} />
                  <span className="text-[14px] font-bold text-foreground">{cfg.label}</span>
                  <span className="text-[12px] text-muted-foreground">{rows.length}개 과제</span>
                  <span className="ml-auto tabular-nums text-[12px] text-muted-foreground">
                    소계 <span className="font-semibold text-foreground">{rows.reduce((s, k) => s + k.weight, 0)}%</span>
                  </span>
                </div>

                {rows.map((kpi) => (
                  <KpiCheckInCard
                    key={kpi.kpiId}
                    kpi={kpi}
                    checkIn={checkIns[kpi.kpiId] ?? defaultCheckIn(kpi)}
                    onChange={(patch) => updateCheckIn(kpi.kpiId, patch)}
                    readOnly={readOnly || confirmed}
                  />
                ))}
              </div>
            );
          })}

          {/* 상반기 총평 — 종합 코멘트 탭 통합 */}
          <Card title="상반기 총평">
            <TextField
              label="상반기 총평"
              hideLabel
              multiline
              rows={4}
              value={selfNote}
              onChange={setSelfNote}
              readOnly={readOnly || confirmed}
              placeholder="상반기 전체 진척에 대한 종합 의견을 적어주세요. (선택사항)"
            />
            {selfDone && myReview?.selfSubmittedAt && (
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                제출일: {new Date(myReview.selfSubmittedAt).toLocaleDateString('ko-KR')}
              </p>
            )}
          </Card>

          {/* 가중치 합 + 제출 버튼 */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-muted border border-border">
            <span className="text-[12px] text-muted-foreground">
              전체 가중치{' '}
              <span className="font-semibold text-foreground tabular-nums">{weightSum}%</span>
            </span>
            {canSubmit && (
              <Button
                loading={submitting}
                onClick={() => void handleSubmit()}
                leftIcon={<Send size={13} />}
              >
                {selfDone ? '자가점검 재제출' : '자가점검 제출'}
              </Button>
            )}
          </div>
        </div>

        {/* 탭 2: 부서장 피드백 */}
        <div style={{ display: sectionTab === 'feedback' ? 'block' : 'none' }}>
          {!selfDone ? (
            <EmptyState
              title="자가점검을 제출하면 부서장 피드백을 여기서 확인할 수 있어요."
            />
          ) : (
            <Card title="부서장 피드백">
              {confirmed && myReview?.reviewerNote ? (
                <div className="flex flex-col gap-2">
                  <p className="whitespace-pre-wrap text-[13px] text-foreground leading-relaxed">
                    {myReview.reviewerNote}
                  </p>
                  <span className="text-[11.5px] text-info-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-info-500 inline-block" />
                    확인 완료
                    {myReview.reviewerName ? ` (${myReview.reviewerName})` : ''}
                    {myReview.confirmedAt
                      ? ` · ${new Date(myReview.confirmedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`
                      : ''}
                  </span>
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  부서장이 피드백을 작성하고 확인 처리하면 여기서 확인할 수 있어요.
                </p>
              )}
            </Card>
          )}
        </div>

        {/* 탭 3: 보완조치·재조정 */}
        <div style={{ display: sectionTab === 'actions' ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
          {/* 보완 조치 */}
          {!actionLoading && myItems.length === 0 ? (
            <EmptyState title="배정된 보완 조치가 없어요." />
          ) : (
            <Card title={`보완 조치 (${myItems.length}건)`}>
              <div className="flex flex-col gap-2">
                {myItems.map((it) => (
                  <ActionItemRow
                    key={it.id}
                    item={it}
                    mode={readOnly ? 'readonly' : 'assignee'}
                    onChangeStatus={changeStatus}
                    busy={busyItemId === it.id}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* 목표 재조정 — accordion, mid_review 단계에서만 표시 */}
          {isMidReview && (
            <div className="rounded-lg border border-border bg-card shadow-elev-1 overflow-hidden">
              <button
                onClick={() => setRebaselineOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-2.5 bg-muted cursor-pointer"
              >
                <span className="text-[13px] font-semibold text-foreground">
                  목표 재조정
                </span>
                {rebaselineOpen ? (
                  <ChevronDown size={15} className="text-muted-foreground" />
                ) : (
                  <ChevronRight size={15} className="text-muted-foreground" />
                )}
              </button>
              {rebaselineOpen && (
                <div className="p-4 bg-card">
                  <RebaselineRequestSection
                    cycleId={cycleId}
                    userId={user.id}
                    readOnly={readOnly}
                  />
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
