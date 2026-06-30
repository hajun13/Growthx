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

export function Card({
  title,
  action,
  padding = 'md',
  className,
  children,
}: CardProps) {
  return (
    <UICard className={cn('gx-work-surface', className)}>
      {(title || action) && (
        <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 border-b border-border px-4 py-3">
          {title ? (
            <CardTitle className="text-[15px] font-bold leading-[1.45] tracking-normal text-foreground">
              {title}
            </CardTitle>
          ) : (
            <span />
          )}
          {action}
        </CardHeader>
      )}
      <CardContent className={cn(padding === 'sm' ? 'p-4' : 'p-4 md:p-5')}>
        {children}
      </CardContent>
    </UICard>
  );
}
