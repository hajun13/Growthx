'use client';

import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

export interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /** 접근성 레이블 (aria-label). placeholder 와 다를 때만 지정. */
  ariaLabel?: string;
}

/**
 * @deprecated — L1(@/components/ui/input-group) 사용으로 이관 대상.
 * SearchInput — 좌측 Search 아이콘 · 지우기 버튼이 있는 검색 입력.
 *
 * 사용 예:
 * <SearchInput value={q} onChange={setQ} placeholder="이름·이메일 검색" />
 */
export function SearchInput({
  value,
  onChange,
  placeholder = '검색',
  className,
  ariaLabel,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <InputGroup className={cn('inline-flex h-9 w-auto min-w-50', className)}>
      <InputGroupAddon align="inline-start">
        <Search aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        type="text"
        role="searchbox"
        aria-label={ariaLabel ?? placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full"
      />
      {/* 우측 지우기 버튼 — 값 있을 때만 */}
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            variant="secondary"
            size="icon-xs"
            aria-label="검색어 지우기"
            onClick={handleClear}
          >
            <X aria-hidden />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
