'use client';

import Link from 'next/link';
import { Loader2, FileSearch, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Skeleton as UISkeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <UISkeleton className={className} />;
}

export function Spinner({ label = '불러오는 중이에요' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex items-center justify-center py-10"
    >
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[128px] items-center justify-center rounded-none border border-dashed border-border bg-muted/20 px-5 py-6 text-left">
      <div className="flex max-w-3xl items-start gap-3">
      <div
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-card text-muted-foreground ring-1 ring-border"
      >
        <FileSearch className="h-4 w-4" />
      </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-5 text-foreground">{title}</p>
          {description && (
            <p className="mt-1 max-w-[620px] text-[12.5px] leading-5 text-muted-foreground">{description}</p>
          )}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
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
      <AlertTriangle className="h-4 w-4" aria-hidden />
      <div>
        <AlertTitle>문제가 발생했어요</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </Alert>
  );
}

export function Forbidden({
  message = '이 페이지에 접근할 권한이 없어요.',
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-[160px] items-center justify-center rounded-none border border-dashed border-border bg-muted/20 px-5 py-8 text-left">
      <div className="flex max-w-2xl items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-card text-muted-foreground ring-1 ring-border">
          <ShieldAlert className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-[14px] font-semibold leading-5 text-foreground">접근 불가</p>
          <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">{message}</p>
          <Link href="/dashboard" className="mt-3 inline-flex">
            <Button variant="secondary" size="sm">
              메인으로
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
