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
  description?: React.ReactNode;
  action?: React.ReactNode;
  padding?: 'sm' | 'md';
  elevation?: 'none' | 'sm' | 'md';
  tone?: 'card' | 'flat';
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export function Card({
  title,
  description,
  action,
  padding = 'md',
  elevation = 'sm',
  tone = 'card',
  className,
  headerClassName,
  contentClassName,
  children,
}: CardProps) {
  return (
    <UICard
      className={cn(
        'rounded-lg border-border/80 shadow-none',
        tone === 'card' && elevation === 'sm' && 'shadow-elev-1',
        tone === 'card' && elevation === 'md' && 'shadow-elev-2',
        tone === 'flat' && 'border-x-0 border-b border-t bg-transparent',
        className,
      )}
    >
      {(title || action) && (
        <CardHeader
          className={cn(
            'flex flex-row items-start justify-between gap-4 space-y-0 border-b border-border/80 px-5 py-4',
            headerClassName,
          )}
        >
          <div className="min-w-0">
            {title ? (
              <CardTitle className="text-[15px] font-bold leading-6 tracking-normal text-foreground">
                {title}
              </CardTitle>
            ) : (
              <span />
            )}
            {description && (
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action}
        </CardHeader>
      )}
      <CardContent
        className={cn(
          padding === 'sm' ? 'p-4' : 'p-5 md:p-6',
          contentClassName,
        )}
      >
        {children}
      </CardContent>
    </UICard>
  );
}
