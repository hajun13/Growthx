'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

export interface EvaluationActionPanelProps {
  message?: ReactNode;
  summary?: ReactNode;
  actions: ReactNode;
  /** true 면 화면 하단에 고정(sticky) — 긴 평가 폼에서 제출 액션 상시 노출. 기본 false(기존 동작). */
  sticky?: boolean;
  className?: string;
}

export function EvaluationActionPanel({
  message,
  summary,
  actions,
  sticky = false,
  className,
}: EvaluationActionPanelProps) {
  return (
    // Card = bg-card(불투명) + 카드 radius·그림자. sticky 면 하단 고정(뒤 콘텐츠 비침 없음).
    <Card className={cn('px-5 py-4', sticky && 'sticky bottom-0 z-20', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          {message && (
            <p className="text-12h font-medium leading-relaxed text-muted-foreground">
              {message}
            </p>
          )}
          {summary}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {actions}
        </div>
      </div>
    </Card>
  );
}
