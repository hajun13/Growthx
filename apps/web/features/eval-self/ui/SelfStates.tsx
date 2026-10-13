'use client';

// 본인평가 화면의 빈/에러/로딩/안내 블록 — L1(Empty·Alert·Skeleton·Card) 조합.
import Link from 'next/link';
import { AlertTriangle, FileSearch } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer } from '@/components/PageContainer';

export function SelfSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
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

/** 평가 기간(창) 밖 — 작성·제출 차단 안내 */
export function WindowClosedBanner({ windowText }: { windowText: string }) {
  return (
    <Alert variant="warning">
      <AlertDescription>
        <p>
          <b>지금은 본인평가 기간이 아니에요.</b> 평가 기간은 <b>{windowText}</b> 이에요. 이 기간에만 작성·제출할 수 있어요.
        </p>
      </AlertDescription>
    </Alert>
  );
}

/** 상급자 반려/수정요청 배너 — 사유 표시 + 보완 후 재제출 안내 */
export function SentBackBanner({ rejected, reason }: { rejected: boolean; reason: string | null }) {
  return (
    <Alert variant={rejected ? 'destructive' : 'warning'}>
      <AlertDescription>
        <p>
          <b>{rejected ? '본인평가가 반려됐어요.' : '상급자가 수정을 요청했어요.'}</b> 내용을 보완한 뒤 다시 제출해 주세요.
          {reason && <span className="mt-1 block whitespace-pre-wrap text-foreground">사유: {reason}</span>}
        </p>
      </AlertDescription>
    </Alert>
  );
}

/** 카드형 안내(미시작·KPI 없음·확정 대기) — 제목/설명/CTA */
export function PromptCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <div className="px-6 py-12 text-center">{children}</div>
    </Card>
  );
}

export function LinkButton({
  href,
  variant,
  children,
}: {
  href: string;
  variant: 'default' | 'outline';
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant={variant}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
