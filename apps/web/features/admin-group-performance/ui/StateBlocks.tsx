'use client';

// 빈/에러/접근불가 블록 — 레거시 components/States 대체(L1 Empty·Alert·Button 조합).
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20">
      <Empty className="min-h-32 gap-3 p-5 md:p-5">
        <EmptyHeader>
          <EmptyTitle className="text-14 font-semibold text-foreground">{title}</EmptyTitle>
          {description && <EmptyDescription className="text-12h">{description}</EmptyDescription>}
        </EmptyHeader>
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
        <Button variant="outline" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </Alert>
  );
}

export function Forbidden({ message = '이 페이지에 접근할 권한이 없어요.' }: { message?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20">
      <Empty className="min-h-40 gap-3 p-5 md:p-5">
        <EmptyHeader>
          <EmptyTitle className="text-14 font-semibold text-foreground">접근 불가</EmptyTitle>
          <EmptyDescription className="text-12h">{message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">메인으로</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
