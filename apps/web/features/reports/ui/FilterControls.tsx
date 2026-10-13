'use client';

// 필터 바 공용 컨트롤 — L1 Select / InputGroup 조합(구 components/Select·SearchInput 래퍼 대체).
import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface FilterOption {
  value: string;
  label: string;
}

/** 라벨 숨김(접근성 이름 = aria-label) 단일 선택. 빈 값은 placeholder 로 표시. */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** 좌측 검색 아이콘 + 값 있을 때 지우기 버튼. */
export function FilterSearch({
  value,
  onChange,
  placeholder = '검색',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <InputGroup className={cn('inline-flex h-9 w-auto min-w-50', className)}>
      <InputGroupAddon align="inline-start">
        <Search aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        ref={ref}
        type="text"
        role="searchbox"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full"
      />
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            variant="secondary"
            size="icon-xs"
            aria-label="검색어 지우기"
            onClick={() => {
              onChange('');
              ref.current?.focus();
            }}
          >
            <X aria-hidden />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
