'use client';

// reports·reports-summary 공용 빈/에러/권한 없음 상태 — L1(Empty·Alert) 조합.
import Link from 'next/link';
import { AlertTriangle, FileSearch, ShieldAlert } from 'lucide-react';
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

export function ReportEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Empty className="min-h-32 p-6 md:p-6">
      <EmptyHeader className="max-w-3xl">
        <EmptyMedia variant="icon">
          <FileSearch aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

export function ReportError({
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

export function ReportForbidden({
  message = '이 페이지에 접근할 권한이 없어요.',
}: {
  message?: string;
}) {
  return (
    <Empty className="min-h-40 p-8 md:p-8">
      <EmptyHeader className="max-w-2xl">
        <EmptyMedia variant="icon">
          <ShieldAlert aria-hidden />
        </EmptyMedia>
        <EmptyTitle>접근 불가</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">메인으로</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
