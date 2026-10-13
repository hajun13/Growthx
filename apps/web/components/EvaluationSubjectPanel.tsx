'use client';

import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

// 이름 해시 → 파스텔 5색 로테이션(같은 이름은 항상 같은 색). 구 L2 Avatar 폴백과 동일.
const AVATAR_TONES = ['blue', 'green', 'purple', 'amber', 'mint'] as const;

function toneOf(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** 평가 대상 이니셜 아바타(사진 필드 없음 — 파스텔 폴백). EvaluationDetailHeader 도 사용. */
export function SubjectAvatar({ name, size }: { name: string; size: 'sm' | 'lg' }) {
  const label = name.trim() ? name : '?';
  return (
    <Avatar size={size}>
      <AvatarFallback role="img" aria-label={name} size={size} tone={toneOf(label)}>
        {label.charAt(0)}
      </AvatarFallback>
    </Avatar>
  );
}

export interface EvaluationSubjectItem {
  id: string;
  name: string;
  description?: string | null;
  meta?: string | null;
  active?: boolean;
  accessory?: ReactNode;
  onSelect: () => void;
}

export interface EvaluationSubjectPanelProps {
  title: string;
  count?: number;
  countUnit?: string;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  emptyMessage?: string;
  items: EvaluationSubjectItem[];
  className?: string;
  maxHeightClassName?: string;
}

export function EvaluationSubjectPanel({
  title,
  count,
  countUnit = '명',
  search,
  onSearch,
  searchPlaceholder = '검색',
  searchAriaLabel,
  emptyMessage = '검색 결과가 없어요.',
  items,
  className,
  maxHeightClassName = 'max-h-160',
}: EvaluationSubjectPanelProps) {
  return (
    <aside
      className={cn(
        'gx-rail overflow-hidden self-start',
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border bg-muted px-4 py-3">
        <h3 className="shrink-0 text-13 font-bold text-foreground">
          {title}
          {count !== undefined && (
            <span className="ml-1 font-semibold tabular-nums text-muted-foreground">
              {count}{countUnit}
            </span>
          )}
        </h3>
        <InputGroup className="ml-auto h-9 w-42 min-w-0">
          <InputGroupAddon align="inline-start">
            <Search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            role="searchbox"
            aria-label={searchAriaLabel ?? searchPlaceholder}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-full"
          />
          {search && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                variant="secondary"
                size="icon-xs"
                aria-label="검색어 지우기"
                onClick={() => onSearch('')}
              >
                <X aria-hidden />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      </div>

      <div className={cn('overflow-y-auto', maxHeightClassName)}>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-12h text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {items.map((item) => (
              <li key={item.id}>
                <Button
                  variant="row-select"
                  size="row-select"
                  data-active={item.active ? 'true' : 'false'}
                  onClick={item.onSelect}
                >
                  <SubjectAvatar name={item.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-13h font-bold leading-snug text-foreground">
                      {item.name}
                      {item.meta && (
                        <span className="ml-1.5 text-11 font-medium text-muted-foreground">
                          {item.meta}
                        </span>
                      )}
                    </span>
                    {item.description && (
                      <span className="mt-0.5 block truncate text-11h text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </span>
                  {item.accessory && (
                    <span className="flex shrink-0 items-center gap-1.5">
                      {item.accessory}
                    </span>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
