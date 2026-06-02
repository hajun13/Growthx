'use client';

import { cx } from '@/lib/ui';

export interface FlowStep {
  key: string;
  label: string;
  state: 'done' | 'current' | 'upcoming' | 'locked';
}

export interface ProcessFlowProps {
  steps: FlowStep[];
}

const stateText: Record<FlowStep['state'], string> = {
  done: '완료',
  current: '진행중',
  upcoming: '예정',
  locked: '잠금',
};

const circleClass: Record<FlowStep['state'], string> = {
  done: 'bg-success-500 text-neutral-0 border-success-500',
  current: 'bg-primary-500 text-neutral-0 border-primary-500',
  upcoming: 'bg-neutral-0 text-neutral-400 border-neutral-300',
  locked: 'bg-neutral-100 text-neutral-400 border-neutral-200',
};

export function ProcessFlow({ steps }: ProcessFlowProps) {
  return (
    <ol className="flex flex-col gap-3 md:flex-row md:items-start md:gap-1">
      {steps.map((step, i) => (
        <li
          key={step.key}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className="flex items-center gap-2 md:flex-1 md:flex-col md:text-center"
        >
          <span
            className={cx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
              circleClass[step.state],
            )}
            aria-hidden
          >
            {step.state === 'done' ? '✓' : step.state === 'locked' ? '🔒' : i + 1}
          </span>
          <span className="flex flex-col md:items-center">
            <span
              className={cx(
                'text-base',
                step.state === 'current'
                  ? 'font-semibold text-neutral-900'
                  : step.state === 'locked'
                    ? 'text-neutral-400'
                    : 'text-neutral-700',
              )}
            >
              {step.label}
            </span>
            <span className="text-xs text-neutral-500">
              {stateText[step.state]}
            </span>
          </span>
          {i < steps.length - 1 && (
            <span
              className="hidden text-neutral-300 md:inline"
              aria-hidden
            >
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
