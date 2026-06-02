'use client';

import Link from 'next/link';
import { cx } from '@/lib/ui';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx('animate-pulse rounded-md bg-neutral-100', className)}
      aria-hidden
    />
  );
}

export function Spinner({ label = '불러오는 중이에요' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex items-center justify-center py-16"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
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
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <div
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400"
      >
        ◍
      </div>
      <p className="text-md font-semibold text-neutral-900">{title}</p>
      {description && <p className="text-base text-neutral-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message = '데이터를 불러오지 못했어요.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-danger-100 bg-danger-50 py-12 text-center">
      <p className="text-base text-danger-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  );
}

export function Forbidden({
  message = '이 페이지에 접근할 권한이 없어요.',
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-lg font-semibold text-neutral-900">403</p>
      <p className="text-base text-neutral-600">{message}</p>
      <Link href="/eval">
        <Button variant="secondary" size="sm">
          메인으로
        </Button>
      </Link>
    </div>
  );
}
