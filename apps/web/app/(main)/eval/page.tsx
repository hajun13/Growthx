'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useEvaluations } from '@/hooks/useEvaluations';
import { useKpis } from '@/hooks/useKpis';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { ProcessFlow, type FlowStep } from '@/components/ProcessFlow';
import {
  WeekScheduleCalendar,
  type SchedulePhase,
} from '@/components/WeekScheduleCalendar';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { canReview, canEvaluateDownward } from '@/lib/nav';
import type { EvalStatus, KpiStatus } from '@/lib/types';

function buildPhases(cycleStatus: string, selfStatus: EvalStatus): SchedulePhase[] {
  const selfBadge =
    selfStatus === 'submitted' || selfStatus === 'finalized'
      ? '완료'
      : selfStatus === 'in_progress'
        ? '진행중'
        : undefined;
  const selfDone = selfStatus === 'submitted' || selfStatus === 'finalized';
  return [
    {
      key: 'prepare',
      label: '평가준비 (KPI 확정)',
      startDate: '6월 2주',
      endDate: '6월 2주',
      status: 'done',
    },
    {
      key: 'self',
      label: '본인평가',
      startDate: '6월 3주',
      endDate: '6월 3주',
      status: selfDone ? 'done' : 'active',
      badge: selfBadge,
    },
    {
      key: 'downward_1',
      label: '1차 팀장 평가',
      startDate: '6월 4주',
      endDate: '6월 4주',
      status: selfDone ? 'upcoming' : 'upcoming',
    },
    {
      key: 'downward_2',
      label: '2차 본부장 평가',
      startDate: '7월 1주',
      endDate: '7월 1주',
      status: 'upcoming',
    },
    {
      key: 'result',
      label: '결과·캘리브레이션',
      startDate: '12월',
      endDate: '12월',
      status: cycleStatus === 'closed' ? 'done' : 'locked',
    },
  ];
}

const WEEKS = [
  { weekLabel: '6월 2주', days: ['8', '9', '10', '11', '12', '13', '14'] },
  { weekLabel: '6월 3주', days: ['15', '16', '17', '18', '19', '20', '21'] },
  { weekLabel: '6월 4주', days: ['22', '23', '24', '25', '26', '27', '28'] },
  { weekLabel: '7월 1주', days: ['29', '30', '1', '2', '3', '4', '5'] },
];

export default function EvalMainPage() {
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="인사평가 메인"
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
      />

      <div className="rounded-md border border-success-100 bg-success-50 px-5 py-4 text-base text-success-700">
        📣 본인평가 기간이에요. 성과중심·협업·성장 KPI 실적을 입력해 주세요.
      </div>

      <Card title="평가 프로세스">
        <ProcessFlow steps={flowSteps} />
      </Card>

      <Card title="주차별 일정">
        <WeekScheduleCalendar
          weeks={WEEKS}
          phases={buildPhases(current.status, selfStatus)}
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
                <span className="text-xs text-neutral-500">🔒 공개예정</span>
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
                    <span className="text-xs font-medium text-primary-700">
                      {reviewCount}건 대기
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500">대기 없음</span>
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
                    <span className="text-xs font-medium text-primary-700">
                      {downwardPending}명 미평가
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500">대기 없음</span>
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
    <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-0 p-4">
      <div className="flex items-center justify-between">
        <span className="text-md font-semibold text-neutral-900">{title}</span>
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
