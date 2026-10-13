'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, FileSearch } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

/** 빈 상태 — 점선 박스 + 아이콘 + 제목/설명(+CTA). */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-32 rounded-lg border border-dashed border-border bg-muted/20">
      <Empty className="p-6 md:p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSearch aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-14 font-semibold text-foreground">{title}</EmptyTitle>
          {description && (
            <EmptyDescription className="text-12h">{description}</EmptyDescription>
          )}
        </EmptyHeader>
        {action && <EmptyContent>{action}</EmptyContent>}
      </Empty>
    </div>
  );
}

/** 에러 상태 — 파괴 톤 Alert + 다시 시도. */
export function ErrorState({
  message = '잠시 문제가 생겼어요. 다시 시도해 주세요.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive" className="flex flex-col items-start gap-3">
      <AlertTriangle aria-hidden />
      <div>
        <AlertTitle>문제가 발생했어요</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </Alert>
  );
}
