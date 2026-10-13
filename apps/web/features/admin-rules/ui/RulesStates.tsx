'use client';

// 평가 규칙 화면의 접근 불가·빈 상태·에러 상태 — L1(Empty/Alert/Button) 조합.
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

export function RulesForbidden({ message }: { message: string }) {
  return (
    <Empty>
      <EmptyHeader>
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

export function RulesEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileSearch aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function RulesLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle aria-hidden />
      <AlertTitle>문제가 발생했어요</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      </AlertDescription>
    </Alert>
  );
}
