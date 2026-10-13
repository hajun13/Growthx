'use client';

// 평가 화면 공용 빈/에러/접근불가 상태 — L1(Empty·Alert·Button) 조합.
// 구 components/States 의 EmptyState/ErrorState/Forbidden 외관·문구 그대로(eval-my·eval-dept-head·eval-result-detail 이 import).
// ponytail: 4개 feature 공용이라 여기 한 곳에 둠 — 다른 그룹에서도 쓰이면 공용 L2(components/)로 승격.
import Link from 'next/link';
import { AlertTriangle, FileSearch, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export function EmptyBox({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-5 py-6">
      <Empty className="p-0 md:p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSearch aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-14 font-semibold text-foreground">{title}</EmptyTitle>
          {description && <EmptyDescription>{description}</EmptyDescription>}
        </EmptyHeader>
        {action && <EmptyContent>{action}</EmptyContent>}
      </Empty>
    </div>
  );
}

export function ErrorBox({
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
        <Button variant="outline" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </Alert>
  );
}

export function ForbiddenBox({ message = '이 페이지에 접근할 권한이 없어요.' }: { message?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-5 py-8">
      <Empty className="p-0 md:p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlert aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-14 font-semibold text-foreground">접근 불가</EmptyTitle>
          <EmptyDescription>{message}</EmptyDescription>
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
