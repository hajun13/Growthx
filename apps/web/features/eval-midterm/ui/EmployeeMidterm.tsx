'use client';

// 본인(employee/부서장 본인) "내 점검" 탭 — 섹션 탭 구조(2026-06-12).
//  - 섹션 탭 4개: KPI 자가점검 / 종합 코멘트 / 부서장 피드백 / 보완조치·재조정
//  - 폼 상태 보존: 전 섹션 마운트 유지 + display:none 토글 (탭 전환 시 입력 보존)
//  - 로직·훅·API·제출 흐름 불변
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
import { GradeChip } from '@/components/GradeChip';
import { ActionItemRow } from '@/components/ActionItemRow';
import { EmptyState, Skeleton } from '@/components/States';
import { InfoBanner } from '@/components/InfoBanner';
import { MidtermSignalBadge } from '@/components/MidtermSignalBadge';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { gradeColor } from '@/lib/grade';
import {
  kpiCategoryLabel,
  kpiGroupLabel,
  kpiTypeLabel,
  fmtPercent,
  fmtAmount,
  measureTypeUnit,
  progressSignalLabel,
} from '@/lib/ui';
import { RebaselineRequestSection } from './RebaselineRequestSection';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/Tabs';
import { cn } from '@/lib/utils';
import type {
  User,
  ActionItem,
  ActionItemStatus,
  MidtermReview,
  KpiProgress,
  Grade,
} from '@/lib/types';

// 그룹별 섹션 색(본인평가·KPI 페이지와 동일).
const GROUP_CFG: Record<string, { label: string; accent: string }> = {
  performance_core: { label: '성과중심 지표', accent: 'bg-primary' },
  collaboration_growth: { label: '협업·성장 지표', accent: 'bg-success-500' },
};
const GROUP_ORDER = ['performance_core', 'collaboration_growth'] as const;

// 등급 점수구간 텍스트(ruleSet 없을 때 폴백).
const DEFAULT_GRADE_SCALE: { grade: Grade; label: string }[] = [
  { grade: 'S', label: '96~100점' },
  { grade: 'A', label: '91~95점' },
  { grade: 'B', label: '85~90점' },
  { grade: 'C', label: '80~84점' },
  { grade: 'D', label: '80점 미만' },
];

// KPI별 자가점검 입력 상태.
interface CheckInInput {
  selfActualText: string;
  selfActualValue: string;
  selfNote: string;
  selfGrade: Grade | '';
}

function defaultCheckIn(kpi: KpiProgress): CheckInInput {
  const ci = kpi.selfCheckIn;
  return {
    selfActualText: ci?.selfActualText ?? '',
    selfActualValue: ci?.selfActualValue !== null && ci?.selfActualValue !== undefined
      ? String(ci.selfActualValue)
      : '',
    selfNote: ci?.selfNote ?? '',
    selfGrade: (ci?.selfGrade as Grade) ?? '',
  };
}

// ── 섹션 탭 정의 ──
type SectionTab = 'checkin' | 'comment' | 'feedback' | 'actions';

const SECTION_TAB_ITEMS: { key: SectionTab; label: string }[] = [
  { key: 'checkin', label: 'KPI 자가점검' },
  { key: 'comment', label: '종합 코멘트' },
  { key: 'feedback', label: '부서장 피드백' },
  { key: 'actions', label: '보완조치·재조정' },
];

// 탭 도트 상태 — done: info-500, todo: warning-500
type DotStatus = 'done' | 'todo' | 'none';

function makeDotBadge(dot: DotStatus): string | number | undefined {
  if (dot === 'done') return '●';
  if (dot === 'todo') return '○';
  return undefined;
}

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
      toast.show({ variant: 'success', message: '자가 점검을 제출했어요.' });
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

  const dots: Record<SectionTab, DotStatus> = useMemo(() => {
    const checkinDot: DotStatus = confirmed ? 'done' : selfDone ? 'done' : canSubmit ? 'todo' : 'none';
    const commentDot: DotStatus = confirmed ? 'done' : selfDone ? 'done' : 'none';
    const feedbackDot: DotStatus = confirmed ? 'done' : selfDone ? 'todo' : 'none';
    const actionsDot: DotStatus =
      myItems.length > 0
        ? myItems.every((i) => i.status === 'done') ? 'done' : 'todo'
        : 'none';
    return { checkin: checkinDot, comment: commentDot, feedback: feedbackDot, actions: actionsDot };
  }, [confirmed, selfDone, canSubmit, myItems]);

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
        title="중간점검할 KPI가 없어요."
        description="KPI가 확정되면 중간 진척을 점검할 수 있어요."
      />
    );
  }

  // 탭 아이템(도트는 badge prop으로 전달 — Tabs 컴포넌트가 렌더)
  const tabItems = SECTION_TAB_ITEMS.map((t) => ({
    key: t.key,
    label: t.label,
    badge: makeDotBadge(dots[t.key]),
  }));

  return (
    <div className="flex flex-col gap-0">
      {/* 제출 상태 안내 */}
      {confirmed && (
        <div className="mb-3">
          <InfoBanner tone="success">
            자가 점검 제출 완료
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
        <div className="mb-3">
          <InfoBanner tone="tip">
            자가 점검 제출 완료 — 부서장 확인 대기 중
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
      <div className="mt-5">

        {/* 탭 1: KPI 자가점검 */}
        <div style={{ display: sectionTab === 'checkin' ? 'flex' : 'none', flexDirection: 'column', gap: 20 }}>
          {GROUP_ORDER.map((group) => {
            const rows = byGroup[group];
            if (!rows || rows.length === 0) return null;
            const cfg = GROUP_CFG[group];
            return (
              <div key={group} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className={cn('w-1 h-4 inline-block rounded-sm flex-shrink-0', cfg.accent)} />
                  <span className="text-[14px] font-bold text-foreground">{cfg.label}</span>
                  <span className="text-[12px] text-muted-foreground">{rows.length}개 과제</span>
                  <span className="ml-auto tabular-nums text-[12px] text-muted-foreground">
                    그룹 가중치 합 {rows.reduce((s, k) => s + k.weight, 0)}%
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

          {/* 가중치 합 + 제출 버튼 */}
          <div className="flex items-center justify-between px-5 py-3 rounded-lg bg-muted border border-border shadow-elev-1">
            <span className="text-[12.5px] text-muted-foreground">
              전체 KPI 가중치 합{' '}
              <span className="font-bold text-foreground tabular-nums">{weightSum}%</span>
              <span className="text-[11px] text-muted-foreground/60 ml-1.5">(검증은 백엔드 수행)</span>
            </span>
            {canSubmit && (
              <Button
                loading={submitting}
                onClick={() => void handleSubmit()}
                leftIcon={<Send size={13} />}
              >
                {selfDone ? '자가 점검 재제출' : '자가 점검 제출'}
              </Button>
            )}
          </div>
        </div>

        {/* 탭 2: 종합 코멘트 */}
        <div style={{ display: sectionTab === 'comment' ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
          <Card title="종합 자가 점검 코멘트">
            <TextField
              label="자가 점검 코멘트"
              hideLabel
              multiline
              rows={6}
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
          {canSubmit && (
            <div className="flex justify-end">
              <Button
                loading={submitting}
                onClick={() => void handleSubmit()}
                leftIcon={<Send size={13} />}
              >
                {selfDone ? '자가 점검 재제출' : '자가 점검 제출'}
              </Button>
            </div>
          )}
        </div>

        {/* 탭 3: 부서장 피드백 */}
        <div style={{ display: sectionTab === 'feedback' ? 'block' : 'none' }}>
          {!selfDone ? (
            <EmptyState
              title="자가 점검을 제출하면 부서장 피드백을 여기서 확인할 수 있어요."
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

        {/* 탭 4: 보완조치·재조정 */}
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

          {/* 목표 재조정 — collapsible, mid_review 아니면 숨김 */}
          {isMidReview && (
            <div className="rounded-lg border border-border bg-card shadow-elev-1 overflow-hidden">
              <button
                onClick={() => setRebaselineOpen((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-3 bg-muted cursor-pointer"
              >
                <span className="text-[13px] font-bold text-muted-foreground">
                  고급 — 목표 재조정
                </span>
                {rebaselineOpen ? (
                  <ChevronDown size={16} className="text-muted-foreground" />
                ) : (
                  <ChevronRight size={16} className="text-muted-foreground" />
                )}
              </button>
              {rebaselineOpen && (
                <div className="p-5 bg-card">
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

// ── KPI 자가점검 카드 ──
function KpiCheckInCard({
  kpi,
  checkIn,
  onChange,
  readOnly,
}: {
  kpi: KpiProgress;
  checkIn: CheckInInput;
  onChange: (patch: Partial<CheckInInput>) => void;
  readOnly: boolean;
}) {
  const cfg = GROUP_CFG[kpi.group];
  const isQual = kpi.isQualitative;
  const typeLabel = kpiTypeLabel(kpi);

  const unit = measureTypeUnit[kpi.measureType];
  const targetStr = kpi.targetText?.trim()
    ? kpi.targetText
    : kpi.targetValue !== null
      ? isQual
        ? kpi.targetText
        : kpi.measureType === 'amount'
          ? fmtAmount(kpi.targetValue)
          : `${kpi.targetValue.toLocaleString('ko-KR')}${unit}`
      : null;

  const gradeOptions: Grade[] = ['S', 'A', 'B', 'C', 'D'];

  return (
    <div className="rounded-lg border border-border bg-card shadow-elev-1 overflow-hidden">
      {/* 카드 헤더 */}
      <div className="flex items-start gap-3 px-5 py-3 border-b border-border bg-muted">
        <span className={cn('inline-block px-2 py-0.5 rounded text-[10.5px] font-semibold text-white flex-shrink-0', cfg.accent)}>
          {kpiCategoryLabel[kpi.category]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-foreground">{kpi.title}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground mt-0.5">
            {kpi.csf && <span>{kpi.csf}</span>}
            {kpi.csf && <span>·</span>}
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 font-semibold rounded-full',
                isQual ? 'bg-warning-50 text-warning-700' : 'bg-purple-50 text-purple-700',
              )}
            >
              {typeLabel}
            </span>
            {targetStr && (
              <>
                <span>·</span>
                <span>목표: {targetStr}</span>
              </>
            )}
            {kpi.measureMethod && (
              <>
                <span>·</span>
                <span>측정: {kpi.measureMethod}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-[11.5px] text-muted-foreground tabular-nums">
            가중치 {kpi.weight}%
          </span>
          {kpi.currentGrade ? (
            <GradeChip grade={kpi.currentGrade} size="sm" />
          ) : kpi.signal !== 'on_track' ? (
            <MidtermSignalBadge signal={kpi.signal} size="sm" />
          ) : null}
        </div>
      </div>

      {/* 진척 정보 */}
      <div className="flex flex-wrap gap-4 px-5 py-2 bg-muted border-b border-border/20">
        <ProgressStat label="누적 달성률" value={isQual ? '–' : fmtPercent(kpi.cumulativeRate)} />
        <ProgressStat
          label="현재실적"
          value={isQual ? '–' : kpi.measureType === 'amount' ? fmtAmount(kpi.cumulativeActual) : `${kpi.cumulativeActual.toLocaleString('ko-KR')}${unit}`}
        />
        <ProgressStat label="신호" value={progressSignalLabel[kpi.signal]} />
      </div>

      {/* 등급 부여 기준 */}
      {kpi.gradingCriteria && (
        <div className="px-5 py-3 border-b border-border/20">
          <div className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
            등급 부여 기준
          </div>
          <div className="grid grid-cols-1 gap-1 md:grid-cols-5">
            {(['S', 'A', 'B', 'C', 'D'] as Grade[]).map((g) => {
              const text = kpi.gradingCriteria?.[g];
              if (!text) return null;
              return (
                <div
                  key={g}
                  className="flex items-start gap-1.5 rounded-md p-1.5 border border-border/30"
                >
                  <span
                    className="w-[18px] h-[18px] text-[10px] font-bold rounded flex-shrink-0 flex items-center justify-center"
                    style={{ background: gradeColor(g).fg, color: '#fff' }}
                  >
                    {g}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-[1.4]">{text}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {DEFAULT_GRADE_SCALE.map((item) => {
              return (
                <span key={item.grade} className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                  <span
                    className="w-3.5 h-3.5 text-[9px] font-bold rounded flex items-center justify-center"
                    style={{ background: gradeColor(item.grade).fg, color: '#fff' }}
                  >
                    {item.grade}
                  </span>
                  {item.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 자가점검 입력 */}
      <div className="flex flex-col gap-3 px-5 py-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* 상반기 실적/진척 입력 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-muted-foreground">
              상반기 실적 / 진척
            </label>
            <Textarea
              rows={2}
              value={checkIn.selfActualText}
              onChange={(e) => onChange({ selfActualText: e.target.value })}
              disabled={readOnly}
              placeholder={isQual ? '상반기 달성한 내용을 서술해 주세요.' : `예) 12.5억, ${unit ? `50${unit}` : '목표의 85%'}`}
              className={cn('resize-none', readOnly && 'bg-muted')}
            />
            {!isQual && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={checkIn.selfActualValue}
                  onChange={(e) => onChange({ selfActualValue: e.target.value })}
                  disabled={readOnly}
                  placeholder={`수치 실적${unit ? ` (${unit})` : ''}`}
                  className={cn('w-36', readOnly && 'bg-muted')}
                />
                {unit && (
                  <span className="text-[12px] text-muted-foreground whitespace-nowrap">{unit}</span>
                )}
              </div>
            )}
          </div>

          {/* 자가 점검 코멘트 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-muted-foreground">
              자가 점검 코멘트 <span className="font-normal text-muted-foreground/60">(선택)</span>
            </label>
            <Textarea
              rows={2}
              value={checkIn.selfNote}
              onChange={(e) => onChange({ selfNote: e.target.value })}
              disabled={readOnly}
              placeholder="달성 배경, 장애요인, 하반기 계획 등 자유롭게 작성하세요."
              className={cn('resize-none', readOnly && 'bg-muted')}
            />
          </div>
        </div>

        {/* 자가 등급 선택(선택사항) */}
        {(isQual || kpi.gradingCriteria) && (
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              자가 등급 선택 <span className="font-normal text-muted-foreground/60">(선택)</span>
            </span>
            <div className="flex gap-1.5">
              {gradeOptions.map((g) => {
                const isSelected = checkIn.selfGrade === g;
                return (
                  <button
                    key={g}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange({ selfGrade: isSelected ? '' : g })}
                    className={cn(
                      'w-7 h-7 text-[12px] font-bold rounded border transition-colors',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                      isSelected ? 'border-2' : 'border bg-muted text-muted-foreground hover:border-border-strong',
                    )}
                    style={
                      isSelected
                        ? { background: gradeColor(g).fg, color: '#fff', borderColor: gradeColor(g).fg }
                        : undefined
                    }
                    title={`자가 등급 ${g}${isSelected ? ' (선택됨)' : ''}`}
                  >
                    {g}
                  </button>
                );
              })}
              {checkIn.selfGrade && (
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => onChange({ selfGrade: '' })}
                  className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground px-1 disabled:opacity-40"
                >
                  해제
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10.5px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-bold text-foreground tabular-nums">{value}</span>
    </div>
  );
}
