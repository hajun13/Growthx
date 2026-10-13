'use client';

// 역량평가 화면의 빈/에러/로딩 블록 — L1(Empty·Alert·Skeleton) 조합.
import { AlertTriangle, FileSearch } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer } from '@/components/PageContainer';

export function CompetencySkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-96 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </PageContainer>
  );
}

export function EmptyBlock({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20">
      <Empty className="min-h-32 md:p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSearch aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-14 font-semibold">{title}</EmptyTitle>
          {description && <EmptyDescription className="text-12h">{description}</EmptyDescription>}
        </EmptyHeader>
      </Empty>
    </div>
  );
}

export function ErrorBlock({ onRetry }: { onRetry?: () => void }) {
  return (
    <Alert variant="destructive" className="flex flex-col items-start gap-3">
      <AlertTriangle aria-hidden />
      <div>
        <AlertTitle>문제가 발생했어요</AlertTitle>
        <AlertDescription>잠시 문제가 생겼어요. 다시 시도해 주세요.</AlertDescription>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </Alert>
  );
}
