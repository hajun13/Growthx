'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  ListChecks,
  ClipboardCheck,
  ChevronRight,
  Info,
  Check,
} from 'lucide-react';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { ApiError } from '@growthx/contracts';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { useKpis } from '@/hooks/useKpis';
import { useEvaluations } from '@/hooks/useEvaluations';
import { EvalReport } from '@/components/EvalReport';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { GradeChip } from '@/components/GradeChip';
import { Avatar } from '@/components/Avatar';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';

import { Button } from '@/components/Button';
import { cn } from '@/lib/utils';
import { fmtScore, positionLabel } from '@/lib/ui';
import type { Grade, ByTypeEntry, KpiStatus, EvalStatus } from '@/lib/types';

import { useMyResultDetail } from '../hooks';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// 진행 스테퍼 단계 데이터(image 3 §5 패턴).
interface EvalStep {
  label: string;
  done: boolean;
  inProgress: boolean;
  grade: Grade | null;
  dateLabel: string; // 완료/진행 단계의 참고 날짜(없으면 빈 문자열)
  dueLabel: string | null; // 미도래 단계의 "MM.DD(요일)까지"
}

// ── 등급 타일(결과 공개 후 요약 카드) ───────────────────────────
function GradeTile({ grade }: { grade: Grade | null }) {
  return (
    <div className="mx-auto mb-2.5 flex size-14 items-center justify-center">
      <GradeChip grade={grade} />
    </div>
  );
}

// ── 평가 진행 스테퍼 (image 3): 완료=진네이비 체크, 진행중=블루 숫자, 미도래=회색 ──
type StepState = 'done' | 'progress' | 'wait';

function stepStateOf(done: boolean, inProgress: boolean): StepState {
  if (done) return 'done';
  if (inProgress) return 'progress';
  return 'wait';
}

function StepNode({ index, state }: { index: number; state: StepState }) {
  if (state === 'done') {
    return (
      <div className="z-10 flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-white">
        <Check size={16} strokeWidth={3} />
      </div>
    );
  }
  if (state === 'progress') {
    return (
      <div className="z-10 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-[14px] font-bold text-primary-foreground">
        {index}
      </div>
    );
  }
  return (
    <div className="z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-[14px] font-bold text-muted-foreground">
      {index}
    </div>
  );
}

function ProgressStepper({ steps }: { steps: EvalStep[] }) {
  // 인접 노드(i-1↔i / i↔i+1) 연결선 — 양쪽 다 완료면 진네이비 실선, 아니면 회색 점선.
  const segSolid = (a: number, b: number) =>
    a >= 0 && b < steps.length && steps[a].done && steps[b].done;
  const seg = (solid: boolean) =>
    solid ? 'h-[2px] bg-foreground' : 'h-0 border-t-2 border-dashed border-border';

  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
      {steps.map((step, idx) => {
        const state = stepStateOf(step.done, step.inProgress);
        const isFirst = idx === 0;
        const isLast = idx === steps.length - 1;
        return (
          <div key={step.label} className="flex flex-col items-center">
            {/* 노드 + 좌우 반쪽 연결선(셀 경계에서 이어져 끊김 없음) */}
            <div className="flex w-full items-center">
              <div className={cn('flex-1', !isFirst && seg(segSolid(idx - 1, idx)))} aria-hidden />
              <StepNode index={idx + 1} state={state} />
              <div className={cn('flex-1', !isLast && seg(segSolid(idx, idx + 1)))} aria-hidden />
            </div>
            <div className="mt-2.5 flex w-full flex-col items-center gap-0.5 px-1 text-center">
              <span
                className={cn(
                  'text-[13px] font-semibold leading-[1.4]',
                  state === 'wait' ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {step.label}
              </span>
              {step.dueLabel ? (
                <span className="text-[12px] font-semibold text-primary">{step.dueLabel}</span>
              ) : (
                <span className="text-[12px] text-muted-foreground">{step.dateLabel}</span>
              )}
              <div className="mt-1.5">
                {step.grade ? (
                  <GradeChip grade={step.grade} size="sm" />
                ) : (
                  <span className="inline-flex h-6 min-w-[44px] items-center justify-center rounded border border-border bg-card px-2 text-[11.5px] font-semibold text-muted-foreground">
                    대기
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MyEvaluationView() {
  const { user, loading: authLoading } = useAuth();
  const {
    cycles,
    current,
    selectedId,
    setSelectedId,
    loading: cycleLoading,
  } = useCurrentCycle();
  const cycleId = current?.id ?? null;
  const [showReport, setShowReport] = useState(false);

  const { data, loading: resultLoading, error } = useMyResultDetail(user?.id ?? null, cycleId);
  const { data: phase } = useCurrentPhase(cycleId, { enabled: !!cycleId });

  const { data: kpiRes, loading: kpiLoading } = useKpis(
    { cycleId: cycleId ?? undefined, userId: user?.id },
    { enabled: !!cycleId && !!user },
  );
  const myKpis = kpiRes?.data ?? [];

  const { data: evalRes, loading: evalLoading } = useEvaluations(
    { cycleId: cycleId ?? undefined, evaluateeId: user?.id },
    { enabled: !!cycleId && !!user },
  );
  const myEvals = evalRes?.data ?? [];

  const displayName = data?.userName ?? user?.name ?? '내 평가표';
  const displayDept = data?.departmentName ?? '';
  const displayTitle = user ? positionLabel[user.position] : '';

  const kpiSummary = useMemo(() => {
    const total = myKpis.length;
    const count = (s: KpiStatus) => myKpis.filter((k) => k.status === s).length;
    const confirmed = count('confirmed');
    const submitted = count('submitted') + count('approved');
    const draft = count('draft');
    const rejected = count('rejected') + count('revision_requested');
    const weightTotal = myKpis.reduce((acc, k) => acc + (k.weight ?? 0), 0);
    return { total, confirmed, submitted, draft, rejected, weightTotal };
  }, [myKpis]);

  // 단계별 마감일(phase.schedules, Cycle Ops §5) — 미도래 단계 "MM.DD(요일)까지" 표시용.
  // 스케줄은 사이클 단계(kpi_selection~final_review) 단위라 평가 단계별 마감이 따로 없다 —
  // 동일 키가 있으면 그것을, 없으면 평가가 속한 final_review 마감으로 폴백(추측 날짜 생성 금지).
  const dueDateOf = (phaseKey: string): string | null => {
    const schedules = phase?.schedules ?? [];
    const exact = schedules.find((s) => s.phase === phaseKey);
    if (exact?.dueDate) return exact.dueDate;
    return schedules.find((s) => s.phase === 'final_review')?.dueDate ?? null;
  };
  const fmtDue = (iso: string | null): string | null => {
    if (!iso) return null;
    // 마감일은 UTC 23:59로 저장됨 — 로컬(KST) 변환 시 다음날로 밀리므로 UTC 달력 기준으로 표시.
    const d = new Date(iso);
    const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()];
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${mm}.${dd}(${dow})`;
  };

  const steps = useMemo(() => {
    const bt = data?.byType;
    const evalDone = (status: EvalStatus | undefined) =>
      status === 'submitted' || status === 'finalized';

    const selfEv = myEvals.find((e) => e.type === 'self');
    const selfDone = bt?.self?.score != null || evalDone(selfEv?.status);

    const downStage = (round: number, entry: ByTypeEntry | undefined) => {
      const ev = myEvals.find((e) => e.type === 'downward' && e.round === round);
      return {
        done: (entry?.score != null) || evalDone(ev?.status),
        inProgress: ev?.status === 'in_progress',
        grade: entry?.grade ?? null,
      };
    };
    const s1 = downStage(1, bt?.downward1);
    const s2 = downStage(2, bt?.downward2);
    const s3 = downStage(3, bt?.downward3);
    const confirmed = data?.finalGrade != null;

    // API에 단계별 완료일시가 없어(Evaluation에 updatedAt 미노출) 완료 단계는 마감일을 참고 정보로,
    // 미도래 단계는 브리프 §5 패턴대로 "MM.DD(요일)까지"만 표시한다(추측 날짜 생성 금지).
    const mkStep = (
      label: string,
      phaseKey: string,
      done: boolean,
      inProgress: boolean,
      grade: Grade | null,
    ): EvalStep => {
      const due = fmtDue(dueDateOf(phaseKey));
      return {
        label,
        done,
        inProgress,
        grade,
        dateLabel: !done && !due ? '' : done ? (due ?? '') : '',
        dueLabel: !done && due ? `${due}까지` : null,
      };
    };

    return [
      // 시안(image 3): 완료 단계 아래 등급 뱃지 — 본인평가도 byType.self 등급을 표시.
      mkStep('본인평가', 'self', selfDone, selfEv?.status === 'in_progress', bt?.self?.grade ?? null),
      mkStep('1차 평가 (팀장)', 'downward1', s1.done, !s1.done && s1.inProgress, s1.grade),
      mkStep('2차 평가 (본부장)', 'downward2', s2.done, !s2.done && s2.inProgress, s2.grade),
      mkStep('최종 평가 (그룹대표)', 'downward3', s3.done, !s3.done && s3.inProgress, s3.grade),
      mkStep('확정 및 완료', 'result', confirmed, false, confirmed ? data?.finalGrade ?? null : null),
    ];
  }, [data, myEvals, phase]);

  const loading = authLoading || cycleLoading || resultLoading || kpiLoading || evalLoading;
  if (loading) return <MySkeleton />;

  if (error instanceof ApiError && error.isForbidden) {
    return <Forbidden message="평가표를 볼 권한이 없어요." />;
  }
  const resultUnavailable = error instanceof ApiError && error.status === 404;
  if (error && !resultUnavailable) {
    return <ErrorState />;
  }
  if (!cycleId) {
    return <EmptyState title="진행 중인 평가 주기가 없어요." />;
  }

  const bg = data?.byGroup;
  const summaryCards = data
    ? [
        { label: '종합평가', grade: data.finalGrade, score: data.finalScore },
        { label: '성과중심 (KPI)', grade: bg?.performance_core.grade ?? null, score: bg?.performance_core.score ?? null },
        { label: '협업·성장', grade: bg?.collaboration_growth.grade ?? null, score: bg?.collaboration_growth.score ?? null },
      ]
    : [];

  // 사이클 선택기 — PageHeader right 슬롯
  const cycleSelector = cycles && cycles.length > 1 ? (
    <Select value={selectedId ?? ''} onValueChange={setSelectedId}>
      <SelectTrigger className="h-9 w-[190px] shrink-0 text-[13px] font-semibold sm:w-[210px]">
        <SelectValue placeholder="평가 주기 선택" />
      </SelectTrigger>
      <SelectContent>
        {cycles.map((c) => (
          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <div className="flex h-9 w-[190px] shrink-0 items-center justify-between gap-2 rounded-md border border-border bg-card px-4 text-[13px] font-semibold text-foreground sm:w-[210px]">
      <span>{current?.name ?? '평가 주기'}</span>
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title="내 평가표"
        subtitle={current?.name ?? undefined}
        right={
          <div className="flex max-w-full items-center gap-2 overflow-x-auto">
            <HeaderMetrics
              className="shrink-0 flex-nowrap"
              items={[
                { label: '확정', value: kpiSummary.confirmed },
                { label: '제출·승인', value: kpiSummary.submitted },
                { label: '작성 중', value: kpiSummary.draft },
                {
                  label: '반려·수정요청',
                  value: kpiSummary.rejected,
                  accent: kpiSummary.rejected > 0 ? 'text-danger-600' : undefined,
                },
              ]}
            />
            {cycleSelector}
          </div>
        }
      />

      {/* 결과 공개 후 — 피평가자 정보 + 평가 결과 요약 */}
      {data && (
        <Card>
          {/* 피평가자 정보 */}
          <div className="flex items-center gap-4 border-b border-border pb-5">
            <Avatar name={displayName} size="lg" />
            <div>
              <div className="text-[18px] font-semibold text-foreground">
                {displayName}{' '}
                <span className="text-[14px] font-normal text-muted-foreground">{displayTitle}</span>
              </div>
              {displayDept && (
                <div className="text-[13px] text-muted-foreground mt-0.5">{displayDept}</div>
              )}
            </div>
          </div>

          {/* 평가 결과 요약 */}
          <div className="pt-5">
            <div className="mb-4 text-[13px] font-semibold text-foreground">평가 결과 요약</div>
            <div className="grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3">
              {summaryCards.map((item) => (
                <div key={item.label} className="border-b border-border p-5 text-center last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
                  <div className="mb-3 text-[12px] text-muted-foreground">{item.label}</div>
                  <GradeTile grade={item.grade} />
                  <div className="text-[13px] text-muted-foreground">
                    ({fmtScore(item.score)}점 / 100점)
                  </div>
                </div>
              ))}
            </div>
            {(data.percentile !== null || data.companyAvg !== null) && (
              <div className="mt-4 flex gap-5 text-[12.5px] text-muted-foreground">
                {data.percentile !== null && (
                  <span>
                    전사 상위 <strong className="text-foreground">{data.percentile}%</strong>
                  </span>
                )}
                {data.companyAvg !== null && (
                  <span>
                    전사 평균 <strong className="text-foreground tabular-nums">{fmtScore(data.companyAvg)}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 상세 평가표 보기 — 링크형(브리프 §4), 보조 액션은 그레이 outline */}
          <div className="mt-5 flex gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border bg-card px-5 py-2.5 text-[13px] font-semibold text-primary transition-colors hover:bg-muted"
            >
              <FileText size={14} />
              상세 평가표 보기
            </button>
            <Link
              href={`/eval/result/${user!.id}`}
              className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border bg-card px-5 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              평가결과 상세
            </Link>
          </div>
        </Card>
      )}

      {/* KPI 요약 헤더 */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <ListChecks size={18} className="text-primary" />
          <span className="text-[16px] font-semibold leading-[1.4] text-foreground">내 KPI</span>
          <span className="text-[13px] text-muted-foreground">
            {kpiSummary.total}개 · 가중치 합 {kpiSummary.weightTotal}%
          </span>
        </div>
        <Link
          href="/kpi"
          className="flex items-center gap-1 text-primary text-[13px] font-semibold hover:underline transition-colors"
        >
          KPI 작성 <ChevronRight size={15} />
        </Link>
      </div>

      {/* 평가 진행 현황 */}
      <Card title={<span className="flex items-center gap-2"><ClipboardCheck size={18} className="text-primary" />평가 진행 현황</span>}>
        <ProgressStepper steps={steps} />

        <div className="mt-6 flex items-center gap-3 rounded-md border border-border bg-muted/40 p-5">
          <Info size={20} className="text-muted-foreground flex-shrink-0" />
          <p className="text-[13px] leading-[1.5] text-muted-foreground">
            확정된 평가 결과는 캘리브레이션이 끝나면 이 화면에서 공개돼요.
          </p>
        </div>
      </Card>

      {/* "현재 단계" 안내 카드는 사용자 피드백(2026-07-02)으로 제거 — 스테퍼가 동일 정보를 전달. */}

      {/* EvalReport 모달 */}
      {showReport && data && (
        <EvalReport
          data={{
            name: displayName,
            dept: displayDept,
            title: displayTitle,
            finalGrade: data.finalGrade,
            finalScore: data.finalScore,
            percentile: data.percentile,
            companyAvg: data.companyAvg,
            byType: data.byType,
            byGroup: data.byGroup,
            cycleName: current?.name,
          }}
          onClose={() => setShowReport(false)}
        />
      )}
    </PageContainer>
  );
}

function MySkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-72 w-full rounded-lg" />
    </PageContainer>
  );
}
