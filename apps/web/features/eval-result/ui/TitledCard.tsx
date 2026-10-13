'use client';

// 제목 헤더가 있는 카드 — L1 Card 조합(구 components/Card 의 title/action 헤더 외관 재현).
// ponytail: 평가 화면 4개 feature 공용 — 다른 그룹도 쓰면 공용 L2 로 승격.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  title?: React.ReactNode;
  action?: React.ReactNode;
  /** 본문 패딩: md(기본, p-4 md:p-5) | sm(p-4). */
  padding?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
}

export function TitledCard({ title, action, padding = 'md', className, children }: Props) {
  return (
    <Card className={className}>
      {(title || action) && (
        <div className="border-b border-border">
          <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
            {title ? (
              <CardTitle className="text-15 font-bold leading-5.5 tracking-normal text-foreground">{title}</CardTitle>
            ) : (
              <span />
            )}
            {action}
          </CardHeader>
        </div>
      )}
      {padding === 'sm' ? (
        <CardContent className="p-4">{children}</CardContent>
      ) : (
        <CardContent className="p-4 md:p-5">{children}</CardContent>
      )}
    </Card>
  );
}
