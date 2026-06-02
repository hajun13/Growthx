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
      className="flex items-center justify-center py-16"
    >
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
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
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <FileSearch className="h-6 w-6" />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
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
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <ShieldAlert className="h-10 w-10 text-muted-foreground" aria-hidden />
      <p className="text-lg font-semibold text-foreground">접근 불가</p>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link href="/eval">
        <Button variant="secondary" size="sm">
          메인으로
        </Button>
      </Link>
    </div>
  );
}
