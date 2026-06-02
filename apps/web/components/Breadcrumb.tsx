'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// 하위 화면 경로 표시: "← 상위로 이동 / A > B" (레퍼런스 패턴).
export interface Crumb {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  // 상위로 이동 링크
  backHref: string;
  backLabel?: string;
  items: Crumb[];
  className?: string;
}

export function Breadcrumb({
  backHref,
  backLabel = '상위로 이동',
  items,
  className,
}: BreadcrumbProps) {
  return (
    <nav
      aria-label="현재 위치"
      className={cn('flex flex-wrap items-center gap-2 text-sm', className)}
    >
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {backLabel}
      </Link>
      <span className="text-border" aria-hidden>
        |
      </span>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    last ? 'font-bold text-foreground' : 'text-muted-foreground',
                  )}
                  aria-current={last ? 'page' : undefined}
                >
                  {c.label}
                </span>
              )}
              {!last && (
                <ChevronRight
                  className="h-3.5 w-3.5 text-muted-foreground/60"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
