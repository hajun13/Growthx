'use client';

/** admin-users 전용 상태 화면 — 구 States.Forbidden/ErrorState 를 L1(Empty·Alert) 조합으로 대체. */

import Link from 'next/link';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

export function Forbidden({ message = '이 페이지에 접근할 권한이 없어요.' }: { message?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><ShieldAlert aria-hidden /></EmptyMedia>
          <EmptyTitle>접근 불가</EmptyTitle>
          <EmptyDescription>{message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline" size="sm"><Link href="/dashboard">메인으로</Link></Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

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
        <Button variant="outline" size="sm" onClick={onRetry}>다시 시도</Button>
      )}
    </Alert>
  );
}
