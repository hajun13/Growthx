'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/Button';
import { cn } from '@/lib/utils';

export interface FilterBarProps {
  children: React.ReactNode;
  resultLabel?: React.ReactNode;
  onReset?: () => void;
  resetLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function FilterBar({
  children,
  resultLabel,
  onReset,
  resetLabel = '초기화',
  actions,
  className,
}: FilterBarProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-border/80 bg-card px-4 py-3',
        className,
      )}
      aria-label="검색 및 필터"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {children}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {resultLabel && (
            <span className="text-[13px] font-semibold text-muted-foreground">
              {resultLabel}
            </span>
          )}
          {onReset && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
              onClick={onReset}
            >
              {resetLabel}
            </Button>
          )}
          {actions}
        </div>
      </div>
    </section>
  );
}
