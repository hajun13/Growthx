'use client';

import { Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  done: 'bg-success-500 text-white border-success-500',
  current: 'bg-primary text-white border-primary ring-4 ring-primary/15',
  upcoming: 'bg-card text-muted-foreground border-input',
  locked: 'bg-muted text-muted-foreground border-border',
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
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center border text-sm font-semibold',
              circleClass[step.state],
            )}
            aria-hidden
          >
            {step.state === 'done' ? (
              <Check className="h-4 w-4" />
            ) : step.state === 'locked' ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              i + 1
            )}
          </span>
          <span className="flex flex-col md:items-center">
            <span
              className={cn(
                'text-sm',
                step.state === 'current'
                  ? 'font-semibold text-foreground'
                  : step.state === 'locked'
                    ? 'text-muted-foreground'
                    : 'text-foreground',
              )}
            >
              {step.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {stateText[step.state]}
            </span>
          </span>
          {i < steps.length - 1 && (
            <span
              className="hidden text-muted-foreground/50 md:inline"
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
