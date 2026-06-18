'use client';

import { Fragment } from 'react';
import { cn } from '@/lib/utils';

export interface HeaderMetricItem {
  label: string;
  value: React.ReactNode;
  /** 값 색 강조 클래스(예: 'text-danger-600'). 기본 뉴트럴(잉크). */
  accent?: string;
}

/**
 * HeaderMetrics — 헤더용 컴팩트 지표 스트립.
 * 거대 숫자·코너 아이콘 타일의 "AI 대시보드" 요약 카드를 대체하는 절제된 한 줄 요약.
 * 구분선으로 나뉜 `label value` 쌍. 페이지 헤더 영역(우측 슬롯 또는 헤더 직하)에 배치.
 *
 * 예: <HeaderMetrics items={[{label:'전체', value:122}, {label:'미입력', value:4, accent:'text-danger-600'}]} />
 */
export function HeaderMetrics({
  items,
  className,
}: {
  items: HeaderMetricItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border bg-card px-4 py-2',
        className,
      )}
    >
      {items.map((it, i) => (
        <Fragment key={it.label}>
          {i > 0 && (
            <span className="hidden h-3.5 w-px bg-border sm:block" aria-hidden />
          )}
          <span className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-[12px] text-muted-foreground">{it.label}</span>
            <span
              className={cn(
                'text-[13px] font-semibold tabular-nums leading-none',
                it.accent ?? 'text-foreground',
              )}
            >
              {it.value}
            </span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}
