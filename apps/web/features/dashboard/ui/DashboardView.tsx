'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  FileText,
  Flag,
} from 'lucide-react';
import { getLabelClasses } from '@energyx/v2-design-system';
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
import type { EvalStatus, CycleStatus } from '@/lib/types';
import { useDashboardSummary } from '../hooks';

type StepState = 'done' | 'active' | 'pending';
type IconType = typeof FileText;

const STEP_CLASS: Record<StepState, string> = {
  done: 'border-[#b0b8c1] bg-[#8b95a1] text-white',
  active: 'border-[var(--gx-primary)] bg-[var(--gx-primary)] text-white shadow-[0_0_0_6px_var(--gx-primary-soft)]',
  pending: 'border-[#d1d6db] bg-white text-[#4e5968]',
};

const STEP_TEXT: Record<StepState, string> = {
  done: '완료',
  active: '진행중',
  pending: '대기',
};

function fmtMonthDay(iso: string): string {
  const d = new Date(iso);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${wd})`;
}

function diffDays(iso?: string | null): string {
  if (!iso) return '-';
  const today = new Date();
  const due = new Date(iso);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'D-Day';
  return days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
}

function StatusLabel({ state, children }: { state: StepState | 'notice'; children: React.ReactNode }) {
  const tone = state === 'active' || state === 'notice' ? 'primary' : 'darkgray';
  return (
    <span
      className={getLabelClasses({
        tone,
        variant: 'border',
        className: 'h-6 rounded-[8px] border-0 px-2 text-[12px] font-bold',
      })}
    >
      {children}
    </span>
  );
}

function SummaryBand({
  cycleName,
  phaseLabel,
  completionRate,
  deadline,
}: {
  cycleName: string;
  phaseLabel: string;
  completionRate: number;
  deadline?: string | null;
}) {
  const items: { icon: IconType; label: string; value: string; sub?: string; accent?: boolean }[] = [
    { icon: CalendarDays, label: '현재 주기', value: cycleName },
    { icon: Flag, label: '평가 단계', value: phaseLabel, accent: true },
    { icon: BarChart3, label: '전체 완료율', value: `${completionRate}%` },
    { icon: Clock3, label: '마감까지', value: diffDays(deadline), sub: deadline ? `${fmtMonthDay(deadline)} 마감` : undefined },
  ];

  return (
    <section className="gx-panel grid gap-0 overflow-hidden md:grid-cols-2 xl:grid-cols-4">
      {items.map(({ icon: Icon, label, value, sub, accent }, index) => (
        <div key={label} className="flex min-h-[104px] items-center gap-5 px-7 py-5">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${accent ? 'bg-[var(--gx-primary-soft)] text-[var(--gx-primary)]' : 'bg-[#f2f4f6] text-[#4e5968]'}`}>
            <Icon size={22} strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#4e5968]">{label}</p>
            <p className={`mt-1 truncate text-[22px] font-black ${accent ? 'text-[#191f28]' : 'text-[#191f28]'}`}>
              {value}
            </p>
            {sub && <p className="mt-1 text-[12px] font-medium text-[#8b95a1]">{sub}</p>}
          </div>
          {index < items.length - 1 && <div className="ml-auto hidden h-16 w-px bg-[#d1d6db] xl:block" />}
        </div>
      ))}
    </section>
  );
}

function ProgressStepper({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <section className="gx-panel px-7 py-5">
      <h2 className="text-[18px] font-black text-[#191f28]">평가 진행 단계</h2>
      <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-5 md:gap-0">
        {steps.map((step, index) => (
          <div key={step.label} className="relative flex flex-col items-center text-center">
            {index > 0 && (
              <span
                className={`absolute top-4 hidden h-0.5 md:block ${
                  step.state === 'pending' ? 'bg-[#d1d6db]' : 'bg-[var(--gx-primary)]'
                }`}
                style={{ left: '0', right: 'calc(50% + 16px)' }}
              />
            )}
            {index < steps.length - 1 && (
              <span
                className={`absolute top-4 hidden h-0.5 md:block ${
                  steps[index + 1].state === 'pending' ? 'bg-[#d1d6db]' : 'bg-[var(--gx-primary)]'
                }`}
                style={{ left: 'calc(50% + 16px)', right: '0' }}
              />
            )}
            <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-[13px] font-black ${STEP_CLASS[step.state]}`}>
              {step.state === 'done' ? <Check size={16} aria-hidden /> : index + 1}
            </span>
            <p className="mt-4 text-[14px] font-black text-[#191f28]">{step.label}</p>
            <p className={`mt-1 text-[12px] font-bold ${step.state === 'active' ? 'text-[var(--gx-primary)]' : 'text-[#8b95a1]'}`}>
              {STEP_TEXT[step.state]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActionPanel({
  rows,
}: {
  rows: { title: string; state: StepState | 'notice'; action: string; href: string; primary?: boolean }[];
}) {
  const router = useRouter();
  return (
    <section className="gx-panel overflow-hidden">
      <div className="border-b border-[#e5e8eb] px-5 py-4">
        <h2 className="text-[18px] font-black text-[#191f28]">내가 확인할 항목</h2>
      </div>
      <div className="divide-y divide-[#e5e8eb] px-5">
        {rows.map((row) => (
          <div key={row.title} className="grid min-h-[46px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${row.primary ? 'bg-[var(--gx-primary)]' : 'bg-[#b0b8c1]'}`} />
              <span className="truncate text-[14px] font-semibold text-[#191f28]">{row.title}</span>
            </div>
            <StatusLabel state={row.state}>{row.state === 'notice' ? '확인 필요' : STEP_TEXT[row.state]}</StatusLabel>
            {row.primary ? (
              <Button size="sm" onClick={() => router.push(row.href)}>{row.action}</Button>
            ) : (
              <button type="button" className="gx-text-button" onClick={() => router.push(row.href)}>
                {row.action}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function SchedulePanel({ items }: { items: { label: string; date: string; state: StepState }[] }) {
  return (
    <section className="gx-panel overflow-hidden">
      <div className="border-b border-[#e5e8eb] px-5 py-4">
        <h2 className="text-[18px] font-black text-[#191f28]">평가 일정</h2>
      </div>
      <ol className="relative mx-5 my-4">
        {items.length === 0 ? (
          <li className="py-10 text-center text-[14px] font-medium text-[#8b95a1]">예정된 일정이 없어요.</li>
        ) : (
          <>
            <span
              className="absolute left-[14px] top-[16px] w-px bg-[#d1d6db]"
              style={{ height: `calc(100% - 32px)` }}
              aria-hidden
            />
            {items.map((item) => (
            <li
              key={`${item.label}-${item.date}`}
              className="relative grid min-h-[46px] grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-3 py-2"
            >
              {item.state === 'active' && (
                <span
                  className="absolute inset-y-1 left-7 right-0 rounded-lg bg-[var(--gx-primary-soft)]"
                  aria-hidden
                />
              )}
              <div className="relative z-10 flex items-center justify-center">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${item.state === 'active' ? 'border-[var(--gx-primary)] bg-[var(--gx-primary)] text-white' : item.state === 'done' ? 'border-[#4e5968] bg-[#4e5968] text-white' : 'border-[#d1d6db] bg-white'}`}>
                  {item.state === 'done' && <Check size={12} aria-hidden />}
                </span>
              </div>
              <div className="relative z-10 min-w-0 px-3">
                <p className="truncate text-[14px] font-bold text-[#191f28]">{item.label}</p>
              </div>
              <span className={`relative z-10 text-[13px] font-bold tabular-nums ${item.state === 'active' ? 'text-[var(--gx-primary)]' : 'text-[#4e5968]'}`}>
                  {item.date}
              </span>
              <span className="relative z-10">
                <StatusLabel state={item.state}>{STEP_TEXT[item.state]}</StatusLabel>
              </span>
            </li>
            ))}
          </>
        )}
      </ol>
    </section>
  );
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
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-36 w-full" />
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
  const activeSchedule = timeline.find((item) => item.state === 'active') ?? timeline.find((item) => item.state === 'pending');
  const phaseLabel = phase?.phase ? schedulePhaseText(phase.phase) : '대기 중';

  const steps: { label: string; state: StepState }[] = [
    { label: 'KPI 작성', state: kpiConfirmed ? 'done' : kpiStarted ? 'active' : 'pending' },
    { label: '본인평가', state: selfDone ? 'done' : selfActive ? 'active' : 'pending' },
    { label: '상위평가', state: upperDone ? 'done' : upperStarted ? 'active' : 'pending' },
    { label: '조정/검토', state: cycleStatus === 'calibration' ? 'active' : cycleStatus === 'closed' ? 'done' : 'pending' },
    { label: '결과공개', state: hasResult ? 'done' : cycleStatus === 'closed' ? 'active' : 'pending' },
  ];
  const actionRows = [
    {
      title: selfDone ? '본인평가 입력이 완료되었습니다' : '본인평가 입력 기간이 시작되었습니다',
      state: selfDone ? 'done' as const : 'notice' as const,
      action: selfDone ? '보기' : '작성하기',
      href: '/eval/self',
      primary: !selfDone,
    },
    {
      title: kpiConfirmed ? 'KPI 검토가 완료되었습니다' : 'KPI 작성 상태를 확인하세요',
      state: kpiConfirmed ? 'done' as const : kpiStarted ? 'active' as const : 'pending' as const,
      action: kpiStarted ? '보기' : '작성하기',
      href: '/kpi',
    },
    {
      title: hasResult ? '평가 결과가 공개되었습니다' : '평가 결과 공개 전입니다',
      state: hasResult ? 'done' as const : 'pending' as const,
      action: hasResult ? '확인' : '알림 받기',
      href: '/eval/result',
    },
    {
      title: '조직 진행 현황을 확인할 수 있습니다',
      state: 'pending' as const,
      action: '확인',
      href: '/org',
    },
  ];
  const recentRows = [
    { type: '평가', body: `평가 단계가 ${phaseLabel}(으)로 전환되었습니다`, date: activeSchedule?.date ?? '-', state: '확인' },
    { type: 'KPI', body: kpiConfirmed ? 'KPI 검토 상태가 업데이트되었습니다' : 'KPI 작성 상태를 확인할 수 있습니다', date: timeline[0]?.date ?? '-', state: kpiConfirmed ? '완료' : '확인' },
    { type: '일정', body: '결과 공개 일정이 등록되었습니다', date: timeline[timeline.length - 1]?.date ?? '-', state: hasResult ? '완료' : '예정' },
  ];

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title="평가 대시보드"
        subtitle="현재 평가 주기와 나에게 필요한 업무를 확인하세요."
        right={<Button size="lg" onClick={() => window.location.assign('/eval/my')}>내 평가 확인</Button>}
      />

      <SummaryBand
        cycleName={data.cycleName ?? '진행 중인 주기 없음'}
        phaseLabel={phaseLabel}
        completionRate={completionRate}
        deadline={activeSchedule?.rawDate}
      />

      <ProgressStepper steps={steps} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <ActionPanel rows={actionRows} />
        <SchedulePanel items={timeline.slice(0, 5)} />
      </div>

      <section className="gx-panel overflow-hidden">
        <div className="border-b border-[#e5e8eb] px-5 py-4">
          <h2 className="text-[18px] font-black text-[#191f28]">최근 변경사항</h2>
        </div>
        <div className="overflow-x-auto px-5 pb-3">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-[#e5e8eb] text-[12px] font-bold text-[#4e5968]">
                <th className="w-32 py-3">구분</th>
                <th className="py-3">변경 내용</th>
                <th className="w-36 py-3">날짜</th>
                <th className="w-24 py-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((row) => (
                <tr key={`${row.type}-${row.body}`} className="border-b border-[#e5e8eb] last:border-0">
                  <td className="py-3 text-[13px] font-bold text-[#191f28]">{row.type}</td>
                  <td className="py-3 text-[13px] font-medium text-[#4e5968]">{row.body}</td>
                  <td className="py-3 text-[13px] font-semibold text-[#4e5968]">{row.date}</td>
                  <td className="py-3">
                    <span className={`gx-status-chip ${row.state === '확인' ? 'gx-status-chip-current' : ''}`}>
                      {row.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageContainer>
  );
}
