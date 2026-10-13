'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import {
  Breadcrumb as UIBreadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

/**
 * @deprecated — L1(@/components/ui/breadcrumb) 사용으로 이관 대상.
 * "← 상위로 이동 | A > B" 패턴 래퍼 — 내부는 L1 Breadcrumb 위임, 기존 호출부 API 유지.
 */
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
    <UIBreadcrumb aria-label="현재 위치" className={className}>
      <div className="flex flex-wrap items-center gap-2">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>
      <span className="text-sm text-border" aria-hidden>
        |
      </span>
      <BreadcrumbList>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              <BreadcrumbItem>
              {c.href && !last ? (
                <BreadcrumbLink asChild>
                  <Link href={c.href}>{c.label}</Link>
                </BreadcrumbLink>
              ) : (
                // 현재 위치는 링크가 아니므로 role=link 를 쓰는 BreadcrumbPage 대신 aria-current span 유지.
                <span
                  className={last ? 'font-bold text-foreground' : undefined}
                  aria-current={last ? 'page' : undefined}
                >
                  {c.label}
                </span>
              )}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
      </div>
    </UIBreadcrumb>
  );
}
