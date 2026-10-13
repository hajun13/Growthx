'use client';

// 조직도(트리) 뷰의 노드 카드 — 자식 노드를 재귀로 펼친다.
import { useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OrgChartNode, OrgNodeType } from '@/lib/types';

const TYPE_LABEL: Record<OrgNodeType, string> = {
  group: '그룹',
  division: '본부',
  team: '팀',
};

// 레벨별 Tailwind 색 클래스 (그룹=primary, 본부=primary/dim, 팀=info)
const LEVEL_BG = ['bg-primary', 'bg-primary', 'bg-info-500'] as const;
const LEVEL_TEXT = ['text-primary', 'text-primary', 'text-info-700'] as const;

// 카드 최대 폭(168) + 가로 간격(16) — 형제 연결선 길이 계산용.
const CARD_SLOT_PX = 168 + 16;

export function OrgNodeCard({
  node,
  level = 0,
  editable,
  onAction,
}: {
  node: OrgChartNode;
  level?: number;
  editable?: boolean;
  onAction?: (action: 'rename' | 'addChild' | 'delete', node: OrgChartNode) => void;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const bgCls = LEVEL_BG[Math.min(level, LEVEL_BG.length - 1)];
  const textCls = LEVEL_TEXT[Math.min(level, LEVEL_TEXT.length - 1)];

  return (
    <div className="flex flex-col items-center">
      <div className="relative min-w-36 max-w-42 rounded-lg border border-t-3 border-border/50 bg-card p-3.5 transition-colors">
        {/* 인원 배지 */}
        <span
          className={cn(
            'absolute -top-2.5 -right-2 rounded-pill px-2 py-0.5 text-10 font-bold text-white',
            bgCls,
          )}
        >
          {node.totalCount}명
        </span>

        <div
          className={cn(
            'flex flex-col items-center gap-1.5',
            hasChildren ? 'cursor-pointer' : 'cursor-default',
          )}
          onClick={() => hasChildren && setExpanded((v) => !v)}
        >
          {/* 아바타 */}
          <div
            className={cn(
              'flex size-9 items-center justify-center rounded-full text-sm font-bold text-white',
              bgCls,
            )}
          >
            {node.name[0]}
          </div>
          <div className="text-center">
            <div className="text-12h font-bold text-foreground">{node.name}</div>
            <div className={cn('mt-0.5 text-10h font-semibold', textCls)}>
              {TYPE_LABEL[node.type]}
            </div>
            <div className="mt-0.5 text-10 text-muted-foreground">직속 {node.directCount}명</div>
          </div>
        </div>

        {/* 편집 버튼 */}
        {editable && onAction && (
          <div className="mt-2 flex justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {node.type !== 'team' && (
              <Button variant="ghost" size="inline" onClick={() => onAction('addChild', node)}>
                <span className="px-1.5 py-0.5 text-10">+ 하위</span>
              </Button>
            )}
            <Button variant="ghost" size="inline" onClick={() => onAction('rename', node)}>
              <span className="px-1.5 py-0.5 text-10 text-muted-foreground">이름</span>
            </Button>
            <Button variant="ghost" size="inline" onClick={() => onAction('delete', node)}>
              <span className="px-1.5 py-0.5 text-10 text-danger-600">삭제</span>
            </Button>
          </div>
        )}

        {hasChildren && (
          <div className="mt-1.5 flex justify-center">
            {expanded ? (
              <ChevronDown className="size-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="relative">
          <div className="flex h-6 justify-center">
            <div className="h-full w-0.5 bg-border/50" />
          </div>
          <div className="relative">
            <div className="flex justify-center gap-4">
              {children.map((child) => (
                <div key={child.id} className="relative flex flex-col items-center">
                  <div className="mx-auto h-5 w-0.5 bg-border/50" />
                  <OrgNodeCard
                    node={child}
                    level={level + 1}
                    editable={editable}
                    onAction={onAction}
                  />
                </div>
              ))}
            </div>
            {children.length > 1 && (
              <div
                // 형제 수에 비례하는 동적 길이 — CSS 변수로 전달.
                style={{ '--w': `${(children.length - 1) * CARD_SLOT_PX}px` } as CSSProperties}
                className="absolute top-0 left-1/2 h-0.5 w-(--w) -translate-x-1/2 bg-border/50"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
