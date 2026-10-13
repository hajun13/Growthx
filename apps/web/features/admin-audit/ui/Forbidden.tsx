'use client';

/** admin-audit 전용 상태 화면 — 구 States.Forbidden 를 L1(Empty·Alert) 조합으로 대체. */

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
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
