'use client';

// 평가 대시보드 — 클라이언트 시안(2026-07-02) 재현:
// 상단 요약 카드 4종 → 평가 진행 단계 스테퍼 → [내가 확인할 항목 | 평가 일정] → [최근 변경사항 | 우리 조직 진행 현황].
// 데이터 훅·역할 분기는 기존 그대로, 표현 계층만 재구성.
import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { useKpis } from '@/hooks/useKpis';
import { useEvaluations } from '@/hooks/useEvaluations';
import { schedulePhaseText } from '@/lib/ui';
import { canEvaluateDownward } from '@/lib/nav';
import { ErrorState, Skeleton } from '@/components/States';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import type { EvalStatus, CycleStatus, Grade } from '@/lib/types';
import { useDashboardSummary } from '../hooks';
import { StatCards } from './StatCards';
import { PhaseStepper, type StepState } from './PhaseStepper';
import { ChecklistGrid } from './ChecklistGrid';
import { EvalSchedulePanel } from './EvalSchedulePanel';
import { RecentChangesTable, type ChangeRow } from './RecentChangesTable';
import { OrgProgressDonut } from './OrgProgressDonut';
import { buildTodoItems } from './buildTodoItems';

function fmtMonthDay(iso: string): string {
  const d = new Date(iso);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()];
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')} (${wd})`;
}

function diffLabel(iso?: string | null): string {
  if (!iso) return '-';
  const today = new Date();
  const due = new Date(iso);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'D-Day';
  return days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
}

export function DashboardView() {
  const { user } = useAuth();
  const { selectedId, current, loading: cyclesLoading } = useCurrentCycle();
  const enabled = !!user;
  const { data, loading, error, reload } = useDashboardSummary(selectedId, { enabled });
  const { data: phase } = useCurrentPhase(selectedId, { enabled });
  const isDownward = !!user && canEvaluateDownward(user.role);
  const { data: selfEvals } = useEvaluations(
    { cycleId: selectedId ?? undefined, evaluateeId: user?.id, type: 'self' },
    { enabled: enabled && !!selectedId },
  );
  const { data: myKpis } = useKpis(
    { cycleId: selectedId ?? undefined, userId: user?.id },
    { enabled: enabled && !!selectedId },
  );
  const { data: downwardEvals } = useEvaluations(
    { cycleId: selectedId ?? undefined, evaluatorId: user?.id, type: 'downward' },
    { enabled: enabled && !!selectedId && isDownward },
  );

  const timeline = useMemo(() => {
    const activePhase = phase?.phase;
    const now = Date.now();
    return (phase?.schedules ?? [])
      .filter((s) => s.dueDate)
      .map((s) => {
        const due = new Date(s.dueDate).getTime();
        const start = s.startDate ? new Date(s.startDate).getTime() : due;
        const state: StepState =
          s.phase === activePhase || (now >= start && now <= due)
            ? 'active'
            : now > due
              ? 'done'
              : 'pending';
        return { label: schedulePhaseText(s.phase), date: fmtMonthDay(s.dueDate), state, due, rawDate: s.dueDate };
      })
      .sort((a, b) => a.due - b.due);
  }, [phase]);

  if (cyclesLoading || loading) {
    return (
      <PageContainer>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageContainer>
    );
  }
  if (error || !data || !user) return <ErrorState onRetry={reload} />;

  const selfEval = selfEvals?.data[0] ?? null;
  const selfStatus: EvalStatus = selfEval?.status ?? 'not_started';
  const selfDone = selfStatus === 'submitted' || selfStatus === 'finalized';
  const selfActive = selfStatus === 'in_progress';
  const kpiList = myKpis?.data ?? [];
  const kpiConfirmed = kpiList.length > 0 && kpiList.every((k) => k.status === 'confirmed');
  const kpiStarted = kpiList.length > 0;
  const dwAll = downwardEvals?.data ?? [];
  const upperDone = dwAll.length > 0 && dwAll.every((e) => e.status === 'submitted' || e.status === 'finalized');
  const upperStarted = dwAll.some((e) => e.status === 'in_progress' || e.status === 'submitted' || e.status === 'finalized');
  const cycleStatus: CycleStatus | undefined = current?.status ?? (data.cycleStatus as CycleStatus | undefined);
  const hasResult = data.me?.hasResult ?? cycleStatus === 'closed';
  const completionRate = Math.round((data.progress.self.rate + data.progress.downward1.rate + data.progress.downward2.rate) / 3);
  const activeSchedule = timeline.find((i) => i.state === 'active') ?? timeline.find((i) => i.state === 'pending');
  const lastSchedule = timeline[timeline.length - 1];
  const phaseLabel = phase?.phase ? schedulePhaseText(phase.phase) : '대기 중';

  const steps = [
    { label: 'KPI 작성', state: (kpiConfirmed ? 'done' : kpiStarted ? 'active' : 'pending') as StepState },
    { label: '본인평가', state: (selfDone ? 'done' : selfActive ? 'active' : 'pending') as StepState },
    { label: '상위평가', state: (upperDone ? 'done' : upperStarted ? 'active' : 'pending') as StepState },
    { label: '조정/검토', state: (cycleStatus === 'calibration' ? 'active' : cycleStatus === 'closed' ? 'done' : 'pending') as StepState },
    { label: '결과공개', state: (hasResult ? 'done' : cycleStatus === 'closed' ? 'active' : 'pending') as StepState },
  ];

  const todoItems = buildTodoItems({
    kpiConfirmed, kpiStarted, selfDone, selfActive, isDownward, upperDone, upperStarted, hasResult,
  });

  const changeRows: ChangeRow[] = [
    { type: '평가', body: `평가 단계가 ${phaseLabel}(으)로 전환되었습니다.`, date: activeSchedule?.date ?? '-', tone: 'confirm' },
    { type: 'KPI', body: kpiConfirmed ? 'KPI 검토 상태가 업데이트되었습니다.' : 'KPI 작성 상태를 확인할 수 있습니다.', date: timeline[0]?.date ?? '-', tone: kpiConfirmed ? 'done' : 'confirm' },
    { type: '일정', body: '결과 공개 일정이 등록되었습니다.', date: lastSchedule?.date ?? '-', tone: hasResult ? 'done' : 'planned' },
  ];

  // 조직 진행 현황 — summary progress에서 파생: 완료(확정)/진행중(제출)/미시작(미제출). 단계 합산 인원 기준.
  const p = data.progress;
  const totals = p.self.total + p.downward1.total + p.downward2.total;
  const finalized = p.self.finalized + p.downward1.finalized + p.downward2.finalized;
  const submitted = p.self.submitted + p.downward1.submitted + p.downward2.submitted;
  const orgSlices = [
    { label: '완료', count: finalized, color: '#0257CE' },
    { label: '진행중', count: Math.max(0, submitted - finalized), color: '#0ED0D9' },
    { label: '미시작', count: Math.max(0, totals - submitted), color: '#D8DCEB' },
  ];

  return (
    <PageContainer className="flex min-h-[calc(100vh-124px)] flex-col space-y-5">
      <PageHeader
        title="평가 대시보드"
        right={<Button size="md" onClick={() => window.location.assign('/eval/my')}>내 평가 확인</Button>}
      />

      <StatCards
        cycleName={data.cycleName ?? '진행 중인 주기 없음'}
        phaseLabel={phaseLabel}
        completionRate={completionRate}
        dDay={diffLabel(activeSchedule?.rawDate)}
        dueLabel={activeSchedule ? `${activeSchedule.date} 마감` : '-'}
        resultGrade={(data.me?.finalGrade as Grade | null | undefined) ?? null}
        resultOpenLabel={lastSchedule ? `${lastSchedule.date} 마감` : '-'}
      />

      <PhaseStepper steps={steps} />

      <div className="grid flex-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <ChecklistGrid items={todoItems} dDay={activeSchedule ? diffLabel(activeSchedule.rawDate) : null} />
        <EvalSchedulePanel items={timeline} />
        <RecentChangesTable rows={changeRows} />
        <OrgProgressDonut totalPct={completionRate} slices={orgSlices} detailHref="/reports" />
      </div>
    </PageContainer>
  );
}
