'use client';

import { Lock, CircleDot, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PhaseStatus = 'done' | 'active' | 'upcoming' | 'locked';

export interface SchedulePhase {
  key: 'prepare' | 'self' | 'downward_1' | 'downward_2' | 'result';
  label: string;
  startDate: string;
  endDate: string;
  status: PhaseStatus;
  // 셀 카드 안내 문구
  description?: string;
  // 셀 우측 상태 배지(예: "완료", "1명 미완료")
  badge?: string;
  badgeTone?: 'done' | 'pending';
  // 액션 링크
  actionLabel?: string;
  actionHref?: string;
  // 7열(일~토) 중 카드가 놓일 요일 인덱스(0=일). 헤더 바는 주 전체 폭.
  dayIndex?: number;
}

export interface WeekScheduleCalendarProps {
  // 각 주(週): 일~토 7일의 날짜 라벨 + 그 주에 속한 단계들.
  weeks: {
    weekLabel: string;
    days: string[];
    phases: SchedulePhase[];
  }[];
  onPhaseClick?: (key: SchedulePhase['key']) => void;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

// 주 전체 폭 헤더 바(레퍼런스의 파란/회색 진행중 바)
const headerBarClass: Record<PhaseStatus, string> = {
  active: 'bg-primary text-white',
  done: 'bg-[#128240] text-white',
  upcoming: 'bg-[#e3e3e8] text-[#3f3f47]',
  locked: 'bg-[#efeff2] text-[#74747f]',
};

const headerIcon: Record<PhaseStatus, typeof CircleDot> = {
  active: CircleDot,
  done: CheckCircle2,
  upcoming: Clock,
  locked: Lock,
};

const headerText: Record<PhaseStatus, string> = {
  active: '진행중',
  done: '완료',
  upcoming: '예정',
  locked: '잠금',
};

export function WeekScheduleCalendar({
  weeks,
  onPhaseClick,
}: WeekScheduleCalendarProps) {
  return (
    <div role="grid" aria-label="주차별 평가 일정" className="flex flex-col gap-3">
      {/* 요일 헤더 (lg↑) */}
      <div className="hidden grid-cols-7 gap-2 px-1 lg:grid">
        {DOW.map((d, i) => (
          <span
            key={d}
            className={cn(
              'text-center text-xs font-semibold',
              i === 0 ? 'text-[#c8353a]' : i === 6 ? 'text-[#1D4FC4]' : 'text-muted-foreground',
            )}
          >
            {d}요일
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {weeks.map((week) => (
          <div key={week.weekLabel} role="row" className="flex flex-col gap-2">
            {/* 단계 헤더 바(주 전체 폭) */}
            <div className="flex flex-col gap-1.5">
              {week.phases.map((phase) => {
                const Icon = headerIcon[phase.status];
                return (
                  <div
                    key={`${phase.key}-bar`}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold',
                      headerBarClass[phase.status],
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{headerText[phase.status]}</span>
                    <span className="opacity-70" aria-hidden>
                      |
                    </span>
                    <span className="font-bold">{phase.label}</span>
                    <span className="opacity-85">
                      ({phase.startDate} ~ {phase.endDate})
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 7열 day grid (lg↑) — 카드는 dayIndex 위치에. md↓는 카드 세로 리스트. */}
            <div className="hidden grid-cols-7 gap-2 lg:grid">
              {week.days.map((day, di) => {
                const phase = week.phases.find((p) => (p.dayIndex ?? 1) === di);
                return (
                  <div
                    key={di}
                    className="min-h-[120px] rounded-xl border border-[#ccccd4]/50 bg-card p-2"
                  >
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        di === 0
                          ? 'text-[#c8353a]'
                          : di === 6
                            ? 'text-[#1D4FC4]'
                            : 'text-muted-foreground',
                      )}
                    >
                      {day}
                    </span>
                    {phase && (
                      <PhaseCell phase={phase} onPhaseClick={onPhaseClick} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* md↓: 카드 세로 리스트 */}
            <div className="flex flex-col gap-2 lg:hidden">
              {week.phases.map((phase) => (
                <div
                  key={`${phase.key}-mobile`}
                  className="rounded-xl border border-[#ccccd4]/50 bg-card p-3"
                >
                  <PhaseCell phase={phase} onPhaseClick={onPhaseClick} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseCell({
  phase,
  onPhaseClick,
}: {
  phase: SchedulePhase;
  onPhaseClick?: (key: SchedulePhase['key']) => void;
}) {
  const clickable = !!onPhaseClick && phase.status !== 'locked';
  const badgeTone = phase.badgeTone ?? (phase.status === 'done' ? 'done' : 'pending');
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {phase.badge && (
        <span
          className={cn(
            'inline-flex w-fit items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold',
            badgeTone === 'done'
              ? 'bg-[#e9f8ef] text-[#0e6633]'
              : 'bg-[#FDECEC] text-[#a0282d]',
          )}
        >
          {phase.badge}
        </span>
      )}
      {phase.description && (
        <p className="text-[12px] font-medium leading-snug text-foreground">
          {phase.description}
        </p>
      )}
      {phase.actionLabel &&
        (clickable ? (
          <button
            type="button"
            onClick={() => onPhaseClick?.(phase.key)}
            className="inline-flex w-fit items-center gap-0.5 text-[12px] font-bold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {phase.actionLabel}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            {phase.actionLabel}
          </span>
        ))}
    </div>
  );
}
