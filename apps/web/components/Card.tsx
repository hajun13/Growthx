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
    <UICard className={cn(className)}>
      {(title || action) && (
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 border-b border-border py-4">
          {title ? (
            <CardTitle className="text-[15px] font-bold tracking-tight text-foreground">
              {title}
            </CardTitle>
          ) : (
            <span />
          )}
          {action}
        </CardHeader>
      )}
      <CardContent className={cn(padding === 'sm' ? 'p-4' : 'p-6')}>
        {children}
      </CardContent>
    </UICard>
  );
}
