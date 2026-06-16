'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  className?: string;
  /** 최대 표시 페이지 번호 수 (기본 7) */
  maxVisible?: number;
}

/** 표시할 페이지 번호 배열 계산 (생략 부분은 null) */
function getPageNumbers(
  current: number,
  total: number,
  maxVisible: number,
): (number | null)[] {
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const half = Math.floor(maxVisible / 2);
  let start = Math.max(2, current - half + 1);
  let end = Math.min(total - 1, start + maxVisible - 3);

  if (end - start < maxVisible - 3) {
    start = Math.max(2, end - (maxVisible - 3) + 1);
  }

  const pages: (number | null)[] = [1];
  if (start > 2) pages.push(null); // 앞 생략
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push(null); // 뒤 생략
  pages.push(total);
  return pages;
}

/**
 * Pagination — 페이지 번호 + 이전/다음 컨트롤.
 * 1페이지면 이전 비활성, totalPages 이면 다음 비활성.
 * 7개 초과 시 생략부호(...) 처리.
 *
 * 사용 예:
 * <Pagination page={page} totalPages={totalPages} onChange={setPage} />
 */
export function Pagination({
  page,
  totalPages,
  onChange,
  className,
  maxVisible = 7,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(page, totalPages, maxVisible);

  return (
    <nav
      aria-label="페이지 탐색"
      className={cn('flex items-center justify-center gap-1', className)}
    >
      {/* 이전 */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="이전 페이지"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="h-8 w-8 rounded-md"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Button>

      {/* 번호 */}
      {pages.map((p, idx) =>
        p === null ? (
          <span
            key={`ellipsis-${idx}`}
            aria-hidden
            className="flex h-8 w-8 items-center justify-center text-sm text-muted-foreground select-none"
          >
            &hellip;
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? 'default' : 'ghost'}
            size="icon"
            aria-label={`${p}페이지`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
            className={cn(
              'h-8 w-8 rounded-md text-sm',
              p === page && 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {p}
          </Button>
        ),
      )}

      {/* 다음 */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="다음 페이지"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="h-8 w-8 rounded-md"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </nav>
  );
}
