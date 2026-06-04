'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card } from './Card';
import { cn } from '@/lib/utils';

export interface WidgetCardProps {
  title: string;
  tone?: 'neutral' | 'danger' | 'success' | 'info';
  children: React.ReactNode;
  footnote?: string;
  href?: string;
  hrefLabel?: string;
  span?: 1 | 2;
}

// 대시보드 위젯 셀. 기존 Card 시각 그대로, 내부 조립만 표준화.
export function WidgetCard({
  title,
  tone = 'neutral',
  children,
  footnote,
  href,
  hrefLabel = '상세 보기',
  span = 1,
}: WidgetCardProps) {
  return (
    <div className={cn(span === 2 && 'md:col-span-2')}>
      <Card title={title} className="h-full">
        <div className="flex h-full flex-col gap-3">
          <div
            className={cn(
              'flex-1',
              tone === 'danger' && '[&_.widget-number]:text-danger-600',
            )}
          >
            {children}
          </div>
          {footnote && (
            <p className="text-xs text-muted-foreground">{footnote}</p>
          )}
          {href && (
            <Link
              href={href}
              className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {hrefLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
