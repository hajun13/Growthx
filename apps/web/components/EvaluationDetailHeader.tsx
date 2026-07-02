'use client';

import type { ReactNode } from 'react';
import { Avatar } from '@/components/Avatar';
import { cn } from '@/lib/utils';

export interface EvaluationDetailHeaderMetric {
  label: string;
  value: ReactNode;
}

export interface EvaluationDetailHeaderProps {
  name: string;
  description?: string | null;
  meta?: ReactNode;
  status?: ReactNode;
  metric?: EvaluationDetailHeaderMetric;
  actions?: ReactNode;
  className?: string;
}

export function EvaluationDetailHeader({
  name,
  description,
  meta,
  status,
  metric,
  actions,
  className,
}: EvaluationDetailHeaderProps) {
  return (
    <section className={cn('border border-border bg-card px-5 py-4', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={name} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[16px] font-bold leading-snug text-foreground">
                {name}
              </h2>
              {meta}
              {status}
            </div>
            {description && (
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>

        {(metric || actions) && (
          <div className="flex shrink-0 items-center gap-4 sm:justify-end">
            {metric && (
              <div className="text-left sm:text-right">
                <div className="text-[10.5px] font-medium text-muted-foreground">
                  {metric.label}
                </div>
                <div className="mt-1 text-[22px] font-extrabold leading-none tabular-nums text-primary">
                  {metric.value}
                </div>
              </div>
            )}
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}
