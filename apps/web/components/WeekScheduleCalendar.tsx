'use client';

import { cx } from '@/lib/ui';

export interface SchedulePhase {
  key: 'prepare' | 'self' | 'downward_1' | 'downward_2' | 'result';
  label: string;
  startDate: string;
  endDate: string;
  status: 'done' | 'active' | 'upcoming' | 'locked';
  badge?: string;
}

export interface WeekScheduleCalendarProps {
  weeks: { weekLabel: string; days: string[] }[];
  phases: SchedulePhase[];
  onPhaseClick?: (key: SchedulePhase['key']) => void;
}

const barClass: Record<SchedulePhase['status'], string> = {
  active: 'bg-primary-500 text-neutral-0',
  done: 'bg-success-50 text-success-700 border border-success-100',
  upcoming: 'bg-neutral-200 text-neutral-700',
  locked: 'bg-neutral-100 text-neutral-400',
};

const statusText: Record<SchedulePhase['status'], string> = {
  active: '진행중',
  done: '완료',
  upcoming: '예정',
  locked: '잠금',
};

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function WeekScheduleCalendar({
  weeks,
  phases,
  onPhaseClick,
}: WeekScheduleCalendarProps) {
  return (
    <div role="grid" aria-label="주차별 평가 일정" className="flex flex-col gap-4">
      {/* 요일 헤더 (lg↑) */}
      <div className="hidden grid-cols-[88px_repeat(7,1fr)] gap-1 lg:grid">
        <span />
        {DOW.map((d) => (
          <span key={d} className="text-center text-xs text-neutral-500">
            {d}
          </span>
        ))}
      </div>

      {/* 주차 행 (lg↑ 7열, md↓ 세로 리스트) */}
      <div className="flex flex-col gap-2">
        {weeks.map((week) => (
          <div
            key={week.weekLabel}
            role="row"
            className="grid grid-cols-1 gap-1 lg:grid-cols-[88px_repeat(7,1fr)] lg:items-center"
          >
            <span className="text-sm font-medium text-neutral-700">
              {week.weekLabel}
            </span>
            <div className="hidden gap-1 lg:col-span-7 lg:grid lg:grid-cols-7">
              {week.days.map((day, i) => (
                <span
                  key={i}
                  className="h-7 rounded-sm bg-neutral-50 text-center text-xs leading-7 text-neutral-400"
                >
                  {day}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 단계 바 목록 */}
      <ul className="flex flex-col gap-2">
        {phases.map((phase) => {
          const clickable = !!onPhaseClick && phase.status !== 'locked';
          return (
            <li key={phase.key}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onPhaseClick?.(phase.key)}
                aria-label={`${phase.label}, ${statusText[phase.status]}`}
                className={cx(
                  'flex w-full items-center justify-between rounded-md px-4 py-2 text-left text-sm outline-none focus-visible:shadow-focus',
                  barClass[phase.status],
                  clickable ? 'cursor-pointer' : 'cursor-default',
                )}
              >
                <span className="flex items-center gap-2">
                  {phase.status === 'locked' && <span aria-hidden>🔒</span>}
                  <span className="font-medium">{phase.label}</span>
                  <span className="opacity-80">
                    {phase.startDate} ~ {phase.endDate}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {phase.badge && (
                    <span className="rounded-full bg-neutral-0/30 px-2 py-[1px] text-xs">
                      {phase.badge}
                    </span>
                  )}
                  <span className="text-xs">{statusText[phase.status]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
