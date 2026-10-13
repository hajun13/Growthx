'use client';

import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  Collapsible as UICollapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface CollapsibleProps {
  /** 펼침 여부(제어 컴포넌트). */
  open: boolean;
  /** 헤더 클릭 시 토글. */
  onToggle: () => void;
  /** 항상 보이는 헤더(요약). 클릭 시 펼침/접힘. */
  header: React.ReactNode;
  /** open 일 때만 렌더되는 본문(상세). */
  children?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** 본문 영역 패딩 제거(직접 패딩 제어 시). */
  bodyClassName?: string;
}

/**
 * @deprecated — L1(@/components/ui/collapsible) 사용으로 이관 대상.
 * 접기/펴기 카드 — 완료·승인된 항목을 접어두고 클릭하면 펼친다.
 * 카드 외곽(흰 배경·border·elevation)은 L1 Card 가 제공. 헤더는 Radix 트리거(aria-expanded 자동).
 */
export function Collapsible({
  open,
  onToggle,
  header,
  children,
  className,
  headerClassName,
  bodyClassName,
}: CollapsibleProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <UICollapsible open={open} onOpenChange={() => onToggle()}>
        <CollapsibleTrigger className="w-full">
          <div
            className={cn(
              'flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/60',
              headerClassName,
            )}
          >
            <div className="min-w-0 flex-1">{header}</div>
            <ChevronDown
              size={18}
              aria-hidden
              className={cn(
                'shrink-0 text-muted-foreground transition-transform duration-200',
                open && 'rotate-180',
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={cn('border-t border-border px-5 py-4', bodyClassName)}>
            {children}
          </div>
        </CollapsibleContent>
      </UICollapsible>
    </Card>
  );
}
