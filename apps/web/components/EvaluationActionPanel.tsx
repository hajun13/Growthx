'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EvaluationActionPanelProps {
  message?: ReactNode;
  summary?: ReactNode;
  actions: ReactNode;
  className?: string;
}

export function EvaluationActionPanel({
  message,
  summary,
  actions,
  className,
}: EvaluationActionPanelProps) {
  return (
    <section className={cn('border border-border bg-card px-5 py-4', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          {message && (
            <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
              {message}
            </p>
          )}
          {summary}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {actions}
        </div>
      </div>
    </section>
  );
}
