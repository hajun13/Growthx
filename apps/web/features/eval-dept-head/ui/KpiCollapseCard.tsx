'use client';

// 접기/펴기 카드 — L1 Collapsible + Card + Button(row/collapse) 조합(구 components/Collapsible 외관 재현).
// 제어형(open/onToggle). accent=true 면 좌측 4px 바(열림=primary / 닫힘=muted).
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Props {
  open: boolean;
  onToggle: () => void;
  header: React.ReactNode;
  children?: React.ReactNode;
  /** 좌측 선택 바 표시(KPI 카드). */
  accent?: boolean;
  /** 헤더 배경을 muted 로(보조 섹션). */
  headerMuted?: boolean;
  /** 본문 영역 클래스(기본 패딩 없음). */
  bodyClassName?: string;
}

export function KpiCollapseCard({ open, onToggle, header, children, accent, headerMuted, bodyClassName }: Props) {
  const bar = accent ? (open ? 'border-l-4 border-l-primary' : 'border-l-4 border-l-muted-foreground/40') : '';
  return (
    <Card className="w-full overflow-hidden">
      <div className={bar}>
        <Collapsible open={open} onOpenChange={() => onToggle()}>
          <div className={headerMuted ? 'bg-muted' : undefined}>
            <CollapsibleTrigger asChild>
              <Button variant="row" size="collapse">
                <div className="min-w-0 flex-1">{header}</div>
                <ChevronDown
                  size={18}
                  aria-hidden
                  className={open ? 'rotate-180 text-muted-foreground transition-transform duration-200' : 'text-muted-foreground transition-transform duration-200'}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className={`border-t border-border ${bodyClassName ?? ''}`}>{children}</div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Card>
  );
}
