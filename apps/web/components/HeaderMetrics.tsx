'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface HeaderMetricItem {
  label: string;
  value: ReactNode;
  /** 값 색 강조 클래스(예: 'text-danger-600'). 기본 뉴트럴(잉크). */
  accent?: string;
}

/**
 * HeaderMetrics — 헤더용 문맥 메타데이터.
 * 페이지 상단을 통계 카드처럼 보이게 만들지 않도록 배경/박스/구분선을 쓰지 않는다.
 * 주요 업무 영역은 본문 컴포넌트가 맡고, 헤더에는 현재 범위와 상태만 낮은 밀도로 표시한다.
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
    <dl
      className={cn(
        'inline-flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]',
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.label} className="inline-flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
          <dt className="font-medium text-muted-foreground">{it.label}</dt>
          <dd
            className={cn(
              'font-bold tabular-nums leading-none',
              it.accent ?? 'text-foreground',
            )}
          >
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
