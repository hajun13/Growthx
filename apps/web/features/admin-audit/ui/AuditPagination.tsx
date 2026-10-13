'use client';

// 감사 로그 페이지 이동 — ui/pagination 조합(구 components/Pagination 과 동일 동작·접근성 이름).
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';

const MAX_VISIBLE = 7;

// 표시할 페이지 번호(생략 구간은 null)
function pageNumbers(current: number, total: number): (number | null)[] {
  if (total <= MAX_VISIBLE) return Array.from({ length: total }, (_, i) => i + 1);
  const half = Math.floor(MAX_VISIBLE / 2);
  let start = Math.max(2, current - half + 1);
  const end = Math.min(total - 1, start + MAX_VISIBLE - 3);
  if (end - start < MAX_VISIBLE - 3) start = Math.max(2, end - (MAX_VISIBLE - 3) + 1);
  const pages: (number | null)[] = [1];
  if (start > 2) pages.push(null);
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push(null);
  pages.push(total);
  return pages;
}

export function AuditPagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <Pagination aria-label="페이지 탐색">
      <PaginationContent>
        <PaginationItem>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="이전 페이지"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
        </PaginationItem>
        {pageNumbers(page, totalPages).map((p, idx) =>
          p === null ? (
            <PaginationItem key={`ellipsis-${idx}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <Button
                variant={p === page ? 'default' : 'ghost'}
                size="icon-sm"
                aria-label={`${p}페이지`}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onChange(p)}
              >
                {p}
              </Button>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="다음 페이지"
            disabled={page >= totalPages}
            onClick={() => onChange(page + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
