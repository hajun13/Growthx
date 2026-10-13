'use client';

// 빈/에러/접근불가 블록 — 레거시 components/States 대체(L1 Empty·Alert·Button 조합).
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';

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
    <div className="rounded-lg border border-dashed border-border bg-muted/20">
      <Empty className="min-h-32 gap-3 p-5 md:p-5">
        <EmptyHeader>
          <EmptyTitle className="text-14 font-semibold text-foreground">{title}</EmptyTitle>
          {description && <EmptyDescription className="text-12h">{description}</EmptyDescription>}
        </EmptyHeader>
        {action && <EmptyContent>{action}</EmptyContent>}
      </Empty>
    </div>
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
