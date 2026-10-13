'use client';

import {
  Card as UICard,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface CardProps {
  title?: React.ReactNode;
  action?: React.ReactNode;
  padding?: 'sm' | 'md';
  elevation?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
}

/**
 * @deprecated — L1(@/components/ui/card) 사용으로 이관 대상.
 * title/action 헤더 + 본문 패딩을 L1 Card 조합으로 제공하는 호환 래퍼.
 */
export function Card({
  title,
  action,
  padding = 'md',
  className,
  children,
}: CardProps) {
  return (
    <UICard className={className}>
      {(title || action) && (
        <div className="border-b border-border">
          <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
            {title ? (
              <CardTitle className="text-15 font-bold leading-5.5 tracking-normal text-foreground">
                {title}
              </CardTitle>
            ) : (
              <span />
            )}
            {action}
          </CardHeader>
        </div>
      )}
      <CardContent className={cn(padding === 'sm' ? 'p-4' : 'p-4 md:p-5')}>
        {children}
      </CardContent>
    </UICard>
  );
}
