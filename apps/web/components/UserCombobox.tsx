'use client';

// 검색형 사용자 선택 콤보박스 — KPI 일괄 등록의 파일별 대상자 매칭용.
// 활성 사용자 목록(useUsers)을 부모에서 받아 이름/이메일/직급으로 즉석 필터링한다.
// L1 Popover + Command(cmdk) 조합. 패널은 Popover 포털로 body 에 렌더 — 부모 overflow 클리핑 없음,
// 공간 부족 시 위로 플립·스크롤/리사이즈 추적은 Radix 가 처리한다.
import { useMemo, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/types';

export interface UserComboboxProps {
  users: User[];
  value: string | null; // 선택된 userId
  onChange: (userId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  // 파일명 추정으로 제안된 후보(있으면 옵션 상단 강조). 확정은 아님.
  suggestedId?: string | null;
}

const MAX_OPTIONS = 50;

export function UserCombobox({
  users,
  value,
  onChange,
  placeholder = '대상자 선택',
  disabled,
  suggestedId,
}: UserComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => users.find((u) => u.id === value) ?? null,
    [users, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? users.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.position ?? '').toLowerCase().includes(q),
        )
      : users;
    // 제안 후보를 목록 맨 위로.
    if (suggestedId) {
      const idx = base.findIndex((u) => u.id === suggestedId);
      if (idx > 0) {
        const copy = [...base];
        const [s] = copy.splice(idx, 1);
        copy.unshift(s);
        return copy.slice(0, MAX_OPTIONS);
      }
    }
    return base.slice(0, MAX_OPTIONS);
  }, [users, query, suggestedId]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };

  return (
    <div className="flex min-w-50 items-center gap-1">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="min-w-0 flex-1 justify-between"
          >
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-left text-12h font-normal',
                selected ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {selected ? (
                <>
                  {selected.name}
                  <span className="ml-1.5 text-11h text-muted-foreground">{selected.position}</span>
                </>
              ) : (
                placeholder
              )}
            </span>
            <ChevronDown className="text-muted-foreground" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-60 overflow-hidden p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="이름·이메일·직급 검색"
            />
            <CommandList className="max-h-60">
              <CommandEmpty>일치하는 사용자가 없어요.</CommandEmpty>
              {filtered.map((u) => {
                const isSel = u.id === value;
                return (
                  <CommandItem
                    key={u.id}
                    value={u.id}
                    onSelect={() => {
                      onChange(u.id);
                      handleOpenChange(false);
                    }}
                  >
                    <Check className={cn('size-3.5 text-primary', !isSel && 'opacity-0')} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="text-12h text-foreground">{u.name}</span>
                      <span className="ml-1.5 text-11 text-muted-foreground">{u.position}</span>
                      <span className="block truncate text-11 text-muted-foreground">{u.email}</span>
                    </span>
                    {u.id === suggestedId && <Badge variant="default">추천</Badge>}
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && !disabled && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="선택 해제"
          onClick={() => onChange(null)}
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}
