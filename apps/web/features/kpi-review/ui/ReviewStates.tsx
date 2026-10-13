'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, FileSearch, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

/** 점선 박스 + 아이콘 + 제목/설명(+CTA) — 빈 상태·접근 불가 공용 골격. */
function DashedEmpty({
  icon,
  title,
  description,
  action,
  tall,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  tall?: boolean;
}) {
  return (
    <div className={`flex rounded-lg border border-dashed border-border bg-muted/20 ${tall ? 'min-h-40' : 'min-h-32'}`}>
      <Empty className="p-6 md:p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle className="text-14 font-semibold text-foreground">{title}</EmptyTitle>
          {description && <EmptyDescription className="text-12h">{description}</EmptyDescription>}
        </EmptyHeader>
        {action && <EmptyContent>{action}</EmptyContent>}
      </Empty>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <DashedEmpty icon={<FileSearch aria-hidden />} title={title} description={description} />;
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
    <DashedEmpty
      tall
      icon={<ShieldAlert aria-hidden />}
      title="접근 불가"
      description={message}
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">메인으로</Link>
        </Button>
      }
    />
  );
}
