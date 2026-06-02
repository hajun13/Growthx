'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, CalendarRange } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useEvaluations } from '@/hooks/useEvaluations';
import { useKpis } from '@/hooks/useKpis';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { InfoBanner } from '@/components/InfoBanner';
import { StatusBadge } from '@/components/StatusBadge';
import { ProcessFlow, type FlowStep } from '@/components/ProcessFlow';
import {
  WeekScheduleCalendar,
  type SchedulePhase,
} from '@/components/WeekScheduleCalendar';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { canReview, canEvaluateDownward } from '@/lib/nav';
import type { EvalStatus, KpiStatus } from '@/lib/types';

interface BuildArgs {
  cycleStatus: string;
  selfStatus: EvalStatus;
  kpiConfirmed: boolean;
  downwardPending: number;
  canDownward: boolean;
}

// 우리 도메인 타임라인 → 주차별 캘린더 단계.
// 주(週)별 일~토 7일 라벨 + 그 주에 속한 단계.
function buildWeeks(args: BuildArgs) {
  const { cycleStatus, selfStatus, kpiConfirmed, downwardPending, canDownward } =
    args;
  const selfDone = selfStatus === 'submitted' || selfStatus === 'finalized';

  const prepare: SchedulePhase = {
    key: 'prepare',
    label: '평가준비 (KPI 확정)',
    startDate: '6/8',
    endDate: '6/14',
    status: kpiConfirmed ? 'done' : 'active',
    badge: kpiConfirmed ? '완료' : '확정 필요',
    badgeTone: kpiConfirmed ? 'done' : 'pending',
    description: kpiConfirmed
      ? 'KPI 과제를 모두 확정했어요.'
      : 'KPI 과제를 작성·확정하세요.',
    actionLabel: kpiConfirmed ? 'KPI 확인하기' : 'KPI 작성하기',
    dayIndex: 1,
  };

  const self: SchedulePhase = {
    key: 'self',
    label: '본인평가',
    startDate: '6/15',
    endDate: '6/21',
    status: selfDone ? 'done' : 'active',
    badge: selfDone
      ? '완료'
      : selfStatus === 'in_progress'
        ? '작성중'
        : '미완료',
    badgeTone: selfDone ? 'done' : 'pending',
    description: selfDone
      ? '본인평가를 제출했어요.'
      : '성과중심·협업·성장 KPI 실적을 입력하세요.',
    actionLabel: selfDone ? '본인평가 확인하기' : '본인평가 하기',
    dayIndex: 1,
  };

  const d1: SchedulePhase = {
    key: 'downward_1',
    label: '1차 부서장 평가 (팀장)',
    startDate: '6/22',
    endDate: '6/28',
    status: 'upcoming',
    badge: canDownward && downwardPending > 0 ? `${downwardPending}명 미평가` : undefined,
    badgeTone: 'pending',
    description: '팀장이 팀원 KPI 성과를 평가합니다.',
    actionLabel: canDownward ? '부서장 평가 하기' : undefined,
    dayIndex: 1,
  };

  const d2: SchedulePhase = {
    key: 'downward_2',
    label: '2차 부서장 평가 (본부장)',
    startDate: '6/29',
    endDate: '7/5',
    status: 'upcoming',
    description: '본부장이 1차 결과를 검토·확정합니다.',
    actionLabel: canDownward ? '부서장 평가 하기' : undefined,
    dayIndex: 1,
  };

  const result: SchedulePhase = {
    key: 'result',
    label: '결과·캘리브레이션',
    startDate: '7/6',
    endDate: '7/12',
    status: cycleStatus === 'closed' ? 'done' : 'locked',
    description:
      cycleStatus === 'closed'
        ? '평가 결과가 공개됐어요.'
        : '캘리브레이션 완료 후 공개돼요.',
    actionLabel: cycleStatus === 'closed' ? '결과 보기' : '공개예정',
    dayIndex: 1,
  };

  return [
    {
      weekLabel: '6월 2주',
      days: ['8', '9', '10', '11', '12', '13', '14'],
      phases: [prepare],
    },
    {
      weekLabel: '6월 3주',
      days: ['15', '16', '17', '18', '19', '20', '21'],
      phases: [self],
    },
    {
      weekLabel: '6월 4주',
      days: ['22', '23', '24', '25', '26', '27', '28'],
      phases: [d1],
    },
    {
      weekLabel: '7월 1주',
      days: ['29', '30', '1', '2', '3', '4', '5'],
      phases: [d2, result],
    },
  ];
}

export default function EvalMainPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    cycles,
    current,
    selectedId,
    setSelectedId,
    loading: cyclesLoading,
    error: cyclesError,
    reload,
  } = useCurrentCycle();

  const cycleId = current?.id;

  const { data: selfEvals } = useEvaluations(
    { cycleId, evaluateeId: user?.id, type: 'self' },
    { enabled: !!cycleId && !!user },
  );
  const { data: myKpis } = useKpis(
    { cycleId, userId: user?.id },
    { enabled: !!cycleId && !!user },
  );

  // 부서장 평가 — 내가 평가자인 downward 건수
  const { data: downwardEvals } = useEvaluations(
    { cycleId, evaluatorId: user?.id, type: 'downward' },
    { enabled: !!cycleId && !!user && canEvaluateDownward(user.role) },
  );

  const selfEval = selfEvals?.data[0] ?? null;
  const selfStatus: EvalStatus = selfEval?.status ?? 'not_started';

  const kpiList = myKpis?.data ?? [];
  const kpiConfirmed =
    kpiList.length > 0 && kpiList.every((k) => k.status === 'confirmed');
  const kpiStatusForBadge: KpiStatus = kpiConfirmed
    ? 'confirmed'
    : (kpiList[0]?.status ?? 'draft');

  const { data: reviewKpis } = useKpis(
    { cycleId, status: 'submitted' },
    { enabled: !!cycleId && !!user && canReview(user.role) },
  );
  const reviewCount = reviewKpis?.data.length ?? 0;

  const downwardPending =
    downwardEvals?.data.filter(
      (e) => e.status === 'not_started' || e.status === 'in_progress',
    ).length ?? 0;

  const flowSteps: FlowStep[] = useMemo(() => {
    const selfDone = selfStatus === 'submitted' || selfStatus === 'finalized';
    return [
      { key: 'prepare', label: '평가준비', state: 'done' },
      { key: 'self', label: '본인평가', state: selfDone ? 'done' : 'current' },
      { key: 'dh1', label: '1차 팀장', state: 'upcoming' },
      { key: 'dh2', label: '2차 본부장', state: 'upcoming' },
      {
        key: 'result',
        label: '결과',
        state: current?.status === 'closed' ? 'current' : 'locked',
      },
    ];
  }, [selfStatus, current?.status]);

  if (cyclesLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (cyclesError) return <ErrorState onRetry={reload} />;
  if (!current) {
    return (
      <EmptyState
        title="진행 중인 평가 주기가 없어요."
        description="평가 주기가 시작되면 일정과 할 일이 표시돼요."
      />
    );
  }

  const isLeader = !!user && canReview(user.role);
  const isDownwardEvaluator = !!user && canEvaluateDownward(user.role);

  // 캘린더 단계 → 라우트 이동.
  function handlePhaseClick(key: SchedulePhase['key']) {
    if (key === 'prepare') router.push('/kpi');
    else if (key === 'self') router.push('/eval/self');
    else if (key === 'downward_1' || key === 'downward_2')
      router.push('/eval/dept-head');
    else if (key === 'result')
      router.push(`/eval/result/${user?.id}?cycleId=${current!.id}`);
  }

  // 내가 확인할 평가 건수(본인평가 + 부서장 평가 대기) — 상단 요약 문구.
  const myCount =
    (selfStatus === 'submitted' || selfStatus === 'finalized' ? 0 : 1) +
    (isDownwardEvaluator && downwardPending > 0 ? 1 : 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="인사평가"
        subtitle={`${myCount}개의 인사평가를 확인하세요.`}
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <Button variant="secondary" size="sm">
            공지사항
          </Button>
        }
      />

      <InfoBanner tone="info" title="이번 주 할 일을 확인하세요">
        성과중심·협업·성장 KPI 실적을 입력하면 본인평가가 완료돼요. 일정은 아래
        캘린더에서 한눈에 볼 수 있어요.
      </InfoBanner>

      <Card title="평가 프로세스">
        <ProcessFlow steps={flowSteps} />
      </Card>

      <Card
        title="평가 일정"
        action={
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <CalendarRange className="h-4 w-4" aria-hidden />
            {current.name}
          </span>
        }
      >
        <WeekScheduleCalendar
          weeks={buildWeeks({
            cycleStatus: current.status,
            selfStatus,
            kpiConfirmed,
            downwardPending,
            canDownward: isDownwardEvaluator,
          })}
          onPhaseClick={handlePhaseClick}
        />
      </Card>

      <Card title="내 할 일">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TaskCard
            title="KPI 작성"
            badge={<StatusBadge status={kpiStatusForBadge} />}
            actionLabel={kpiConfirmed ? '확인하기' : '작성하기'}
            href="/kpi"
          />
          <TaskCard
            title="본인평가"
            badge={<StatusBadge status={selfStatus} />}
            actionLabel={
              selfStatus === 'submitted' || selfStatus === 'finalized'
                ? '확인하기'
                : '평가하기'
            }
            href="/eval/self"
          />
          <TaskCard
            title="결과 조회"
            badge={
              current.status === 'closed' ? (
                <StatusBadge status="finalized" />
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" aria-hidden />
                  공개예정
                </span>
              )
            }
            actionLabel="결과 보기"
            href={`/eval/result/${user?.id}?cycleId=${current.id}`}
            disabled={current.status !== 'closed'}
          />
        </div>

        {(isLeader || isDownwardEvaluator) && (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {isLeader && (
              <TaskCard
                title="팀원 KPI 검토"
                badge={
                  reviewCount > 0 ? (
                    <span className="text-xs font-medium text-foreground">
                      {reviewCount}건 대기
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">대기 없음</span>
                  )
                }
                actionLabel="검토하기"
                href="/kpi/review"
              />
            )}
            {isDownwardEvaluator && (
              <TaskCard
                title="부서장 평가"
                badge={
                  downwardPending > 0 ? (
                    <span className="text-xs font-medium text-foreground">
                      {downwardPending}명 미평가
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">대기 없음</span>
                  )
                }
                actionLabel="평가하기"
                href="/eval/dept-head"
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function TaskCard({
  title,
  badge,
  actionLabel,
  href,
  disabled,
}: {
  title: string;
  badge: React.ReactNode;
  actionLabel: string;
  href: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-foreground">{title}</span>
        {badge}
      </div>
      {disabled ? (
        <Button variant="secondary" size="sm" disabled>
          {actionLabel}
        </Button>
      ) : (
        <Link href={href}>
          <Button variant="secondary" size="sm" fullWidth>
            {actionLabel}
          </Button>
        </Link>
      )}
    </div>
  );
}
