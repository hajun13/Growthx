'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from './Button';
import { Skeleton } from './States';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { OrgChartNode } from '@/lib/types';

export type OrgNodeAction = 'rename' | 'addChild' | 'move' | 'delete';

export interface OrgTreeProps {
  chart: OrgChartNode | null;
  selectedNodeId: string | null; // null = 회사 루트(전체)
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (nodeId: string | null) => void;
  editable?: boolean;
  onNodeAction?: (action: OrgNodeAction, node: OrgChartNode) => void;
  onAddRoot?: () => void;
  loading?: boolean;
}

// 노드명에 검색어가 매칭되는 하위가 있는지(자동 펼침 판정).
function matchesSubtree(node: OrgChartNode, q: string): boolean {
  if (!q) return false;
  const lower = q.toLowerCase();
  if (node.name.toLowerCase().includes(lower)) return true;
  return (node.children ?? []).some((c) => matchesSubtree(c, lower));
}

export function OrgTree({
  chart,
  selectedNodeId,
  query,
  onQueryChange,
  onSelect,
  editable,
  onNodeAction,
  onAddRoot,
  loading,
}: OrgTreeProps) {
  const company = chart;
  const groups = useMemo(() => company?.children ?? [], [company]);

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-[#ccccd4]/50 bg-card p-3 lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-96px)]">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="이름·조직 검색"
          aria-label="조직 검색"
          className="pl-8"
        />
      </div>

      <div
        role="tree"
        aria-label="조직 트리"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto"
      >
        {loading ? (
          <div className="flex flex-col gap-2 p-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : !company || groups.length === 0 ? (
          <div className="flex flex-col gap-2 px-2 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              조직이 아직 없어요. 아래 버튼으로 추가해요.
            </p>
          </div>
        ) : (
          <>
            {/* 회사 루트 — 클릭=전체 선택 */}
            <button
              type="button"
              role="treeitem"
              aria-selected={selectedNodeId === null}
              aria-level={1}
              onClick={() => onSelect(null)}
              className={cn(
                'flex items-center justify-between gap-2 px-2 py-1.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                selectedNodeId === null
                  ? 'bg-primary/[0.06] font-bold text-foreground ring-1 ring-primary/15'
                  : 'font-medium text-foreground hover:bg-muted',
              )}
            >
              <span className="truncate">{company.name}</span>
              <Badge variant="secondary" className="tabular-nums">
                {company.totalCount}
              </Badge>
            </button>
            {groups.map((g) => (
              <OrgTreeNode
                key={g.id}
                node={g}
                depth={0}
                query={query}
                selectedNodeId={selectedNodeId}
                onSelect={onSelect}
                editable={editable}
                onNodeAction={onNodeAction}
              />
            ))}
          </>
        )}
      </div>

      {editable && company && (
        <div className="border-t border-border pt-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" aria-hidden />}
            onClick={onAddRoot}
          >
            그룹/본부/팀 추가
          </Button>
        </div>
      )}
    </div>
  );
}

interface OrgTreeNodeProps {
  node: OrgChartNode;
  depth: number;
  query: string;
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  editable?: boolean;
  onNodeAction?: OrgTreeProps['onNodeAction'];
}

function OrgTreeNode({
  node,
  depth,
  query,
  selectedNodeId,
  onSelect,
  editable,
  onNodeAction,
}: OrgTreeNodeProps) {
  const hasChildren = (node.children ?? []).length > 0;
  // 검색 중이면 매칭 경로 자동 펼침.
  const autoExpand = query ? matchesSubtree(node, query) : false;
  const [open, setOpen] = useState(false);
  const expanded = query ? autoExpand : open;
  const selected = selectedNodeId === node.id;

  return (
    <div role="treeitem" aria-selected={selected} aria-level={depth + 2}>
      <div
        className={cn(
          'group flex items-center gap-1.5 px-1.5 py-1.5 text-sm transition-colors',
          selected
            ? 'bg-primary/[0.06] font-bold text-foreground ring-1 ring-primary/15'
            : 'hover:bg-muted',
        )}
        style={{ paddingLeft: depth * 16 + 6 }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? '접기' : '펼치기'}
            aria-expanded={expanded}
            onClick={() => !query && setOpen((v) => !v)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        )}

        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="truncate">{node.name}</span>
          <Badge variant="secondary" className="tabular-nums">
            {node.totalCount}
          </Badge>
        </button>

        {editable && onNodeAction && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`${node.name} 작업`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onNodeAction('rename', node)}>
                이름 변경
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNodeAction('addChild', node)}>
                하위 추가
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNodeAction('move', node)}>
                이동
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNodeAction('delete', node)}>
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {expanded &&
        (node.children ?? []).map((c) => (
          <OrgTreeNode
            key={c.id}
            node={c}
            depth={depth + 1}
            query={query}
            selectedNodeId={selectedNodeId}
            onSelect={onSelect}
            editable={editable}
            onNodeAction={onNodeAction}
          />
        ))}
    </div>
  );
}
