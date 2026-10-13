'use client';

// 제목·액션 헤더 + 본문 패널 — L1 Card 조합(구 components/Card 래퍼 대체, reports·reports-summary 공용).
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function ReportCard({
  title,
  action,
  padding = 'md',
  className,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  padding?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      {(title || action) && (
        <div className="border-b border-border">
          <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
            {title ? (
              <CardTitle className="text-15 leading-5.5 font-bold text-foreground">{title}</CardTitle>
            ) : (
              <span />
            )}
            {action}
          </CardHeader>
        </div>
      )}
      <CardContent className={cn(padding === 'sm' ? 'p-4' : 'p-4 md:p-5')}>{children}</CardContent>
    </Card>
  );
}
