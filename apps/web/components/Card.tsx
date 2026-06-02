'use client';

import { cx } from '@/lib/ui';

export interface CardProps {
  title?: string;
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
  elevation = 'sm',
  className,
  children,
}: CardProps) {
  return (
    <section
      className={cx(
        'rounded-md border border-neutral-200 bg-neutral-0',
        elevation === 'md' ? 'shadow-md' : 'shadow-sm',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-5 py-3">
          {title && (
            <h2 className="text-md font-semibold text-neutral-900">{title}</h2>
          )}
          {action}
        </header>
      )}
      <div className={padding === 'sm' ? 'p-3' : 'p-5'}>{children}</div>
    </section>
  );
}
